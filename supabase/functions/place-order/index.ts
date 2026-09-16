// =====================================================================
// place-order — The Chinese Bliss website order creation API
//
// Security model:
// - Browser never sends trusted prices/totals.
// - Server looks up active products and computes totals.
// - Browser roles have no direct write access to order/customer tables.
// - Input validation, request-size limits, origin allowlisting and rate
//   limits are enforced server-side.
// - Idempotency is protected by a database unique index.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  RequestError,
  cleanText,
  enforceRateLimit,
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
  rateLimitKey,
  readJsonBody,
  requestIp,
} from "../_shared/tcb-security.ts";

const PHONE_RE = /^[6-9][0-9]{9}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,100}$/;
const SEQUENTIAL = ["0123456789", "9876543210"];
const DIRECT_DELIVERY_PIN = "411057";

function isValidPhone(phone: string): boolean {
  if (!PHONE_RE.test(phone)) return false;
  if (/^(\d)\1{9}$/.test(phone)) return false;
  if (SEQUENTIAL.some((s) => s.includes(phone))) return false;
  return true;
}

function isValidAddress(address: string): boolean {
  const len = address.trim().length;
  return len >= 25 && len <= 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return jsonResponse(req, { success: false, message: "Origin not allowed." }, 403);
  if (req.method !== "POST") return jsonResponse(req, { success: false, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { success: false, message: "Ordering is temporarily unavailable." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await readJsonBody(req, 28_000);
    const type = body.type;
    const idempotencyKey = cleanText(body.idempotency_key, 100);
    const name = cleanText(body.name, 80);
    const phone = cleanText(body.phone, 20);
    const address = cleanText(body.address, 100);
    const pincode = cleanText(body.pincode, 10);
    const notes = cleanText(body.notes, 500);
    const paymentMethod = cleanText(body.payment_method, 20);
    const couponCode = cleanText(body.coupon_code, 40);
    const deliverySlot = cleanText(body.delivery_slot, 120);
    const eventType = cleanText(body.event_type, 120);
    const deliveryDatetime = cleanText(body.delivery_datetime, 80);
    const items = body.items;

    if (type !== "normal" && type !== "bulk") return jsonResponse(req, { success: false, message: "Invalid order type." }, 400);
    if (!IDEMPOTENCY_RE.test(idempotencyKey)) return jsonResponse(req, { success: false, message: "Invalid checkout attempt." }, 400);
    if (name.length < 2) return jsonResponse(req, { success: false, message: "Name is required." }, 400);
    if (!isValidPhone(phone)) return jsonResponse(req, { success: false, message: "Enter a valid 10-digit mobile number." }, 400);
    if (!isValidAddress(address)) return jsonResponse(req, { success: false, message: "Address must be between 25 and 100 characters." }, 400);
    if (type === "normal" && pincode !== DIRECT_DELIVERY_PIN) {
      return jsonResponse(req, { success: false, message: `Direct website delivery is currently available only in PIN ${DIRECT_DELIVERY_PIN}.` }, 400);
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > (type === "bulk" ? 200 : 60)) {
      return jsonResponse(req, { success: false, message: "Invalid cart." }, 400);
    }
    if (paymentMethod !== "upi") {
      return jsonResponse(req, { success: false, message: "Cash on Delivery is not currently available for direct website orders." }, 400);
    }
    if (type === "bulk" && !deliveryDatetime) return jsonResponse(req, { success: false, message: "Delivery date & time is required." }, 400);
    if (type === "normal" && !deliverySlot) return jsonResponse(req, { success: false, message: "Please select a delivery slot." }, 400);

    const maxQty = type === "bulk" ? 500 : 50;
    const seenProductIds = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object") return jsonResponse(req, { success: false, message: "Invalid item in cart." }, 400);
      const id = cleanText((item as Record<string, unknown>).id, 120);
      const qty = Number((item as Record<string, unknown>).qty);
      if (!id || seenProductIds.has(id) || !Number.isInteger(qty) || qty <= 0 || qty > maxQty) {
        return jsonResponse(req, { success: false, message: "Invalid item in cart." }, 400);
      }
      seenProductIds.add(id);
    }

    const ipKey = await rateLimitKey("place-order-ip", requestIp(req));
    const phoneKey = await rateLimitKey("place-order-phone", phone);
    await enforceRateLimit(supabase, "place-order-ip", ipKey, 15, 900);
    await enforceRateLimit(supabase, "place-order-phone", phoneKey, 6, 900);

    const ordersTable = type === "normal" ? "normal_orders" : "bulk_orders";
    const itemsTable = type === "normal" ? "normal_order_items" : "bulk_order_items";

    const { data: existing } = await supabase
      .from(ordersTable)
      .select("order_number, total")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return jsonResponse(req, { success: true, order_number: existing.order_number, total: existing.total, duplicate: true });
    }

    const normalizedItems = items.map((item) => ({
      id: cleanText((item as Record<string, unknown>).id, 120),
      qty: Number((item as Record<string, unknown>).qty),
    }));
    const productIds = normalizedItems.map((item) => item.id);
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price, active, order_type")
      .in("id", productIds)
      .eq("order_type", type);

    if (productError) {
      console.error("product lookup failed", productError);
      return jsonResponse(req, { success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const productMap = new Map((products ?? []).map((product) => [String(product.id), product]));
    const lineItems: Record<string, unknown>[] = [];
    let subtotalPaise = 0;

    for (const item of normalizedItems) {
      const product = productMap.get(item.id);
      if (!product || !product.active) {
        return jsonResponse(req, { success: false, message: "One or more items in your cart are no longer available." }, 400);
      }
      const unitPaise = Math.round(Number(product.price) * 100);
      if (!Number.isFinite(unitPaise) || unitPaise < 0) {
        console.error("invalid product price", product.id, product.price);
        return jsonResponse(req, { success: false, message: "One or more items cannot be ordered right now." }, 500);
      }
      const linePaise = unitPaise * item.qty;
      subtotalPaise += linePaise;
      lineItems.push({
        product_id: product.id,
        product_name: cleanText(product.name, 200),
        unit_price: unitPaise / 100,
        quantity: item.qty,
        line_total: linePaise / 100,
      });
    }

    const subtotal = subtotalPaise / 100;
    const discount = 0;
    const total = subtotal;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert({ phone, name }, { onConflict: "phone", ignoreDuplicates: false })
      .select("id")
      .single();
    if (customerError || !customer) {
      console.error("customer upsert failed", customerError);
      return jsonResponse(req, { success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const orderRow: Record<string, unknown> = {
      customer_id: customer.id,
      name,
      phone,
      address,
      notes: notes || null,
      subtotal,
      coupon_code: couponCode || null,
      discount,
      total,
      payment_method: paymentMethod,
      payment_status: "pending",
      idempotency_key: idempotencyKey,
    };

    if (type === "bulk") {
      orderRow.event_type = eventType || null;
      orderRow.delivery_datetime = deliveryDatetime;
    } else {
      orderRow.pincode = DIRECT_DELIVERY_PIN;
      orderRow.delivery_slot = deliverySlot;
    }

    const { data: order, error: orderError } = await supabase
      .from(ordersTable)
      .insert(orderRow)
      .select("id, order_number, total")
      .single();

    if (orderError || !order) {
      if ((orderError as { code?: string } | null)?.code === "23505") {
        const { data: duplicate } = await supabase
          .from(ordersTable)
          .select("order_number, total")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (duplicate) return jsonResponse(req, { success: true, order_number: duplicate.order_number, total: duplicate.total, duplicate: true });
      }
      console.error("order insert failed", orderError);
      return jsonResponse(req, { success: false, message: "Could not place your order. Please try again." }, 500);
    }

    const { error: itemsError } = await supabase
      .from(itemsTable)
      .insert(lineItems.map((line) => ({ ...line, order_id: order.id })));

    if (itemsError) {
      console.error("order items insert failed", itemsError);
      const { error: cleanupError } = await supabase.from(ordersTable).delete().eq("id", order.id);
      if (cleanupError) console.error("failed to roll back incomplete order", cleanupError);
      return jsonResponse(req, { success: false, message: "Could not save your order. Please try again." }, 500);
    }

    return jsonResponse(req, { success: true, order_number: order.order_number, total: order.total });
  } catch (err) {
    if (err instanceof RequestError) return jsonResponse(req, { success: false, message: err.message }, err.status);
    console.error("place-order unexpected error", err);
    return jsonResponse(req, { success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

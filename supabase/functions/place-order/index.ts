// =====================================================================
// place-order — The Chinese Bliss website order creation API
//
// SECURITY MODEL
// - Browser never writes database tables directly.
// - Server looks up active products/prices and calculates totals itself.
// - Service-role credentials stay only inside the Edge Function runtime.
// - Input size, shape, rate limits, origin and idempotency are enforced here.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  cleanText,
  jsonResponse,
  preflightResponse,
  rateLimit,
  rateLimitResponse,
  readJsonBody,
  rejectDisallowedOrigin,
} from "../_shared/security.ts";

const PHONE_RE = /^[6-9][0-9]{9}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{8,100}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;
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

  const originFailure = rejectDisallowedOrigin(req);
  if (originFailure) return originFailure;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { success: false, message: "Order service is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Coarse abuse control before parsing any customer-provided data.
    const coarseLimit = await rateLimit(admin, req, "place-order-ip", 24, 600);
    if (!coarseLimit.allowed) return rateLimitResponse(req, coarseLimit.resetAt);

    const parsed = await readJsonBody(req, 32_768);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value ?? {};

    const type = body.type;
    const idempotencyKey = cleanText(body.idempotency_key, 100);
    const name = cleanText(body.name, 80);
    const phone = String(body.phone ?? "").replace(/\D/g, "").slice(-10);
    const address = cleanText(body.address, 100);
    const pincode = cleanText(body.pincode, 12);
    const notes = cleanText(body.notes, 500);
    const couponCode = cleanText(body.coupon_code, 50);
    const deliverySlot = cleanText(body.delivery_slot, 120);
    const eventType = cleanText(body.event_type, 120);
    const deliveryDatetime = cleanText(body.delivery_datetime, 80);
    const paymentMethod = cleanText(body.payment_method, 30);
    const rawItems = body.items;

    if (type !== "normal" && type !== "bulk") {
      return jsonResponse(req, { success: false, message: "Invalid order type." }, 400);
    }
    if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
      return jsonResponse(req, { success: false, message: "Invalid checkout request. Please refresh and try again." }, 400);
    }
    if (name.length < 2) {
      return jsonResponse(req, { success: false, message: "Name is required." }, 400);
    }
    if (!isValidPhone(phone)) {
      return jsonResponse(req, { success: false, message: "Enter a valid 10-digit mobile number." }, 400);
    }
    if (!isValidAddress(address)) {
      return jsonResponse(req, { success: false, message: "Address must be between 25 and 100 characters." }, 400);
    }
    if (type === "normal" && pincode !== DIRECT_DELIVERY_PIN) {
      return jsonResponse(req, { success: false, message: `Direct website delivery is currently available only in PIN ${DIRECT_DELIVERY_PIN}.` }, 400);
    }
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > (type === "bulk" ? 200 : 60)) {
      return jsonResponse(req, { success: false, message: "Invalid cart." }, 400);
    }
    if (paymentMethod !== "upi") {
      return jsonResponse(req, { success: false, message: "Cash on Delivery is not currently available for direct website orders." }, 400);
    }
    if (type === "normal" && !deliverySlot) {
      return jsonResponse(req, { success: false, message: "Please select a delivery slot." }, 400);
    }
    if (type === "bulk") {
      const deliveryTime = Date.parse(deliveryDatetime);
      if (!deliveryDatetime || !Number.isFinite(deliveryTime)) {
        return jsonResponse(req, { success: false, message: "Delivery date & time is required." }, 400);
      }
    }

    // Additional subject-specific rate limit prevents order spam against one
    // phone number even when the browser is manipulated with DevTools.
    const phoneLimit = await rateLimit(admin, req, "place-order-phone", 8, 900, phone);
    if (!phoneLimit.allowed) return rateLimitResponse(req, phoneLimit.resetAt);

    const maxQty = type === "bulk" ? 500 : 50;
    const quantities = new Map<string, number>();
    for (const item of rawItems) {
      const id = cleanText(item?.id, 120);
      const qty = Number(item?.qty);
      if (!PRODUCT_ID_RE.test(id) || !Number.isInteger(qty) || qty <= 0 || qty > maxQty) {
        return jsonResponse(req, { success: false, message: "Invalid item in cart." }, 400);
      }
      const combined = (quantities.get(id) ?? 0) + qty;
      if (combined > maxQty) {
        return jsonResponse(req, { success: false, message: "Item quantity is too high." }, 400);
      }
      quantities.set(id, combined);
    }

    const items = Array.from(quantities, ([id, qty]) => ({ id, qty }));
    const ordersTable = type === "normal" ? "normal_orders" : "bulk_orders";
    const itemsTable = type === "normal" ? "normal_order_items" : "bulk_order_items";

    // Database also has a unique partial index on idempotency_key. This early
    // lookup gives retries a fast, customer-friendly response.
    const { data: existing, error: existingError } = await admin
      .from(ordersTable)
      .select("order_number, total")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      console.error("idempotency lookup failed", existingError);
      return jsonResponse(req, { success: false, message: "Could not place your order. Please try again." }, 500);
    }
    if (existing) {
      return jsonResponse(req, {
        success: true,
        order_number: existing.order_number,
        total: existing.total,
        duplicate: true,
      });
    }

    // Never trust browser prices/totals. Only database products are authoritative.
    const productIds = items.map((item) => item.id);
    const { data: products, error: productError } = await admin
      .from("products")
      .select("id, name, price, active, order_type")
      .in("id", productIds)
      .eq("order_type", type);

    if (productError) {
      console.error("product lookup failed", productError);
      return jsonResponse(req, { success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const productMap = new Map((products ?? []).map((product: any) => [String(product.id), product]));
    const lineItems: Array<{
      product_id: string;
      product_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }> = [];
    let subtotal = 0;

    for (const item of items) {
      const product: any = productMap.get(item.id);
      const unitPrice = Number(product?.price);
      if (!product || !product.active || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return jsonResponse(req, { success: false, message: "One or more items in your cart are no longer available." }, 400);
      }
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;
      lineItems.push({
        product_id: String(product.id),
        product_name: cleanText(product.name, 200),
        unit_price: unitPrice,
        quantity: item.qty,
        line_total: lineTotal,
      });
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0 || subtotal > 1_000_000) {
      return jsonResponse(req, { success: false, message: "Order total is invalid." }, 400);
    }

    // Coupon backend and sub-₹799 delivery-fee integration are intentionally
    // pending. Do not trust browser discount/delivery values until those
    // server-side systems are finalized.
    const discount = 0;
    const total = subtotal - discount;

    const { data: customer, error: customerError } = await admin
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
      order_status: "new",
    };

    if (type === "bulk") {
      orderRow.event_type = eventType || null;
      orderRow.delivery_datetime = deliveryDatetime;
    } else {
      orderRow.pincode = DIRECT_DELIVERY_PIN;
      orderRow.delivery_slot = deliverySlot;
    }

    const { data: order, error: orderError } = await admin
      .from(ordersTable)
      .insert(orderRow)
      .select("id, order_number, total")
      .single();

    if (orderError || !order) {
      // A concurrent retry can hit the unique idempotency index. Return the
      // already-created order rather than creating a duplicate.
      if ((orderError as any)?.code === "23505") {
        const { data: raced } = await admin
          .from(ordersTable)
          .select("order_number, total")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (raced) {
          return jsonResponse(req, { success: true, order_number: raced.order_number, total: raced.total, duplicate: true });
        }
      }
      console.error("order insert failed", orderError);
      return jsonResponse(req, { success: false, message: "Could not place your order. Please try again." }, 500);
    }

    const { error: itemsError } = await admin
      .from(itemsTable)
      .insert(lineItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError) {
      console.error("order items insert failed", itemsError);
      // Fail closed and remove the incomplete order header. This prevents the
      // kitchen from seeing an order without item rows.
      const { error: cleanupError } = await admin.from(ordersTable).delete().eq("id", order.id);
      if (cleanupError) console.error("critical: incomplete order cleanup failed", cleanupError);
      return jsonResponse(req, { success: false, message: "Could not save your order. Please try again." }, 500);
    }

    return jsonResponse(req, { success: true, order_number: order.order_number, total: order.total });
  } catch (error) {
    console.error("place-order unexpected error", error);
    const isRateFailure = error instanceof Error && error.message === "rate_limit_unavailable";
    return jsonResponse(
      req,
      { success: false, message: isRateFailure ? "Order service is temporarily unavailable. Please try again shortly." : "Something went wrong. Please try again." },
      isRateFailure ? 503 : 500,
    );
  }
});

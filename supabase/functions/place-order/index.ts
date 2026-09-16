// =====================================================================
// place-order — The Chinese Bliss direct-order API
//
// Security model:
// - Browser sends only product IDs, quantities and customer/order inputs.
// - Server loads active products and REAL prices from the database.
// - Browser totals/prices/payment state are never trusted.
// - Service-role credentials exist only inside this Edge Function.
// - Public requests are validated, size-limited and rate-limited.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";
const PHONE_RE = /^[6-9][0-9]{9}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEQUENTIAL = ["0123456789", "9876543210"];
const DIRECT_DELIVERY_PIN = "411057";
const MAX_BODY_BYTES = 64 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": PRODUCTION_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

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

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  ).trim().slice(0, 80);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function consumeRateLimit(
  admin: ReturnType<typeof createClient>,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_security_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("place-order rate limit check failed", error);
    return false;
  }
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed." }, 405);
  }
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return jsonResponse({ success: false, message: "Content-Type must be application/json." }, 415);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, message: "Request is too large." }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, message: "Ordering is temporarily unavailable." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const rateKey = await sha256(`place-order:${clientIp(req)}`);
    if (!(await consumeRateLimit(admin, rateKey, 12, 600))) {
      return jsonResponse({
        success: false,
        message: "Too many order attempts. Please wait a few minutes and try again.",
      }, 429);
    }

    const body = await req.json();
    const {
      type,
      idempotency_key,
      name,
      phone,
      address,
      pincode,
      notes,
      items,
      payment_method,
      coupon_code,
      delivery_slot,
      event_type,
      delivery_datetime,
    } = body ?? {};

    if (type !== "normal" && type !== "bulk") {
      return jsonResponse({ success: false, message: "Invalid order type." }, 400);
    }
    if (typeof idempotency_key !== "string" || !UUID_RE.test(idempotency_key)) {
      return jsonResponse({ success: false, message: "Invalid idempotency key." }, 400);
    }

    const cleanName = typeof name === "string" ? name.trim() : "";
    if (cleanName.length < 2 || cleanName.length > 80) {
      return jsonResponse({ success: false, message: "Name must be between 2 and 80 characters." }, 400);
    }

    const cleanPhone = String(phone ?? "").trim();
    if (!isValidPhone(cleanPhone)) {
      return jsonResponse({ success: false, message: "Enter a valid 10-digit mobile number." }, 400);
    }

    const cleanAddress = String(address ?? "").trim();
    if (!isValidAddress(cleanAddress)) {
      return jsonResponse({ success: false, message: "Address must be between 25 and 100 characters." }, 400);
    }

    if (type === "normal" && String(pincode ?? "").trim() !== DIRECT_DELIVERY_PIN) {
      return jsonResponse({
        success: false,
        message: `Direct website delivery is currently available only in PIN ${DIRECT_DELIVERY_PIN}.`,
      }, 400);
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 60) {
      return jsonResponse({ success: false, message: "Invalid cart." }, 400);
    }

    if (payment_method !== "upi") {
      return jsonResponse({
        success: false,
        message: "Cash on Delivery is not currently available for direct website orders.",
      }, 400);
    }

    const maxTotalQty = type === "bulk" ? 500 : 50;
    let totalQty = 0;
    const normalizedItems: { id: string; qty: number }[] = [];
    for (const it of items) {
      if (!it || typeof it.id !== "string" || !Number.isInteger(it.qty) || it.qty <= 0) {
        return jsonResponse({ success: false, message: "Invalid item in cart." }, 400);
      }
      totalQty += it.qty;
      if (totalQty > maxTotalQty) {
        return jsonResponse({ success: false, message: "Order quantity is too large." }, 400);
      }
      normalizedItems.push({ id: it.id, qty: it.qty });
    }

    const cleanNotes = notes === undefined || notes === null ? "" : String(notes).trim();
    if (cleanNotes.length > 500) {
      return jsonResponse({ success: false, message: "Special instructions are too long." }, 400);
    }

    const cleanCoupon = coupon_code === undefined || coupon_code === null
      ? ""
      : String(coupon_code).trim();
    if (cleanCoupon.length > 40) {
      return jsonResponse({ success: false, message: "Coupon code is too long." }, 400);
    }

    if (type === "bulk" && !delivery_datetime) {
      return jsonResponse({ success: false, message: "Delivery date & time is required." }, 400);
    }
    if (
      type === "normal" &&
      (typeof delivery_slot !== "string" || !delivery_slot.trim() || delivery_slot.trim().length > 120)
    ) {
      return jsonResponse({ success: false, message: "Please select a valid delivery slot." }, 400);
    }

    const ordersTable = type === "normal" ? "normal_orders" : "bulk_orders";
    const itemsTable = type === "normal" ? "normal_order_items" : "bulk_order_items";

    // Idempotency prevents double-click/retry duplication.
    const { data: existing, error: existingError } = await admin
      .from(ordersTable)
      .select("order_number, total")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingError) {
      console.error("idempotency lookup failed", existingError);
      return jsonResponse({ success: false, message: "Could not validate this order. Please try again." }, 500);
    }
    if (existing) {
      return jsonResponse({
        success: true,
        order_number: existing.order_number,
        total: existing.total,
        duplicate: true,
      });
    }

    // Server-trusted product lookup and pricing.
    const productIds = [...new Set(normalizedItems.map((item) => item.id))];
    const { data: products, error: productErr } = await admin
      .from("products")
      .select("id, name, price, active, order_type")
      .in("id", productIds)
      .eq("order_type", type);

    if (productErr) {
      console.error("product lookup failed", productErr);
      return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const lineItems: {
      product_id: string;
      product_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }[] = [];
    let subtotal = 0;

    // Consolidate duplicate product IDs before totals are calculated.
    const qtyById = new Map<string, number>();
    for (const item of normalizedItems) {
      qtyById.set(item.id, (qtyById.get(item.id) ?? 0) + item.qty);
    }

    for (const [productId, qty] of qtyById) {
      const product = productMap.get(productId);
      if (!product || !product.active) {
        return jsonResponse({
          success: false,
          message: "One or more items in your cart are no longer available.",
        }, 400);
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        console.error("invalid product price", productId, product.price);
        return jsonResponse({ success: false, message: "Could not price this order." }, 500);
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity: qty,
        line_total: lineTotal,
      });
    }

    // Coupon and logistics pricing are intentionally deferred. Browser values
    // cannot introduce a discount or delivery charge.
    const discount = 0;
    const deliveryFee = 0;
    const total = subtotal - discount + deliveryFee;

    const { data: customer, error: customerErr } = await admin
      .from("customers")
      .upsert(
        { phone: cleanPhone, name: cleanName },
        { onConflict: "phone", ignoreDuplicates: false },
      )
      .select("id")
      .single();

    if (customerErr || !customer) {
      console.error("customer upsert failed", customerErr);
      return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const orderRow: Record<string, unknown> = {
      customer_id: customer.id,
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      notes: cleanNotes || null,
      subtotal,
      coupon_code: cleanCoupon || null,
      discount,
      delivery_fee: deliveryFee,
      total,
      payment_method,
      payment_status: "pending",
      idempotency_key,
    };

    if (type === "bulk") {
      orderRow.event_type = event_type ? String(event_type).trim().slice(0, 120) : null;
      orderRow.delivery_datetime = delivery_datetime;
    } else {
      orderRow.pincode = DIRECT_DELIVERY_PIN;
      orderRow.delivery_slot = delivery_slot.trim();
    }

    const { data: order, error: orderErr } = await admin
      .from(ordersTable)
      .insert(orderRow)
      .select("id, order_number, total")
      .single();

    if (orderErr || !order) {
      console.error("order insert failed", orderErr);
      return jsonResponse({ success: false, message: "Could not place your order. Please try again." }, 500);
    }

    const { error: itemsErr } = await admin
      .from(itemsTable)
      .insert(lineItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsErr) {
      console.error("order items insert failed", itemsErr);
      const { error: cleanupError } = await admin.from(ordersTable).delete().eq("id", order.id);
      if (cleanupError) console.error("orphan order cleanup failed", cleanupError);
      return jsonResponse({ success: false, message: "Could not save your order. Please try again." }, 500);
    }

    return jsonResponse({
      success: true,
      order_number: order.order_number,
      total: order.total,
    });
  } catch (err) {
    console.error("place-order unexpected error", err);
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

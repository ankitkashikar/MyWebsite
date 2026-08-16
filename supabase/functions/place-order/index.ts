// =====================================================================
// place-order — Supabase Edge Function
//
// This is the ONLY thing allowed to write to normal_orders / bulk_orders.
// The browser sends product IDs + quantities + customer details.
// This function looks up REAL prices from the `products` table and
// computes the total itself — it never trusts a price or total sent
// by the client. That's what closes the DevTools price-tampering gap.
//
// Deploy with: supabase functions deploy place-order
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by Supabase inside every Edge Function — you do not set them yourself,
// and they are never exposed to the browser.)
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your real domain once live, e.g. "https://thechinesebliss.com"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PHONE_RE = /^[6-9][0-9]{9}$/;
const SEQUENTIAL = ["0123456789", "9876543210"];

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const {
      type,               // 'normal' | 'bulk'
      idempotency_key,    // uuid, generated client-side once per checkout attempt
      name,
      phone,
      address,
      notes,
      items,              // [{ id: string, qty: number }]
      payment_method,     // 'upi' | 'cod'
      coupon_code,
      delivery_slot,      // normal only — e.g. "ASAP (30–45 min)"
      event_type,         // bulk only
      delivery_datetime,  // bulk only
    } = body ?? {};

    // ---- basic shape validation --------------------------------------
    if (type !== "normal" && type !== "bulk") {
      return jsonResponse({ success: false, message: "Invalid order type." }, 400);
    }
    if (!idempotency_key || typeof idempotency_key !== "string") {
      return jsonResponse({ success: false, message: "Missing idempotency key." }, 400);
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonResponse({ success: false, message: "Name is required." }, 400);
    }
    if (!phone || !isValidPhone(String(phone).trim())) {
      return jsonResponse({ success: false, message: "Enter a valid 10-digit mobile number." }, 400);
    }
    if (!address || !isValidAddress(String(address))) {
      return jsonResponse({ success: false, message: "Address must be between 25 and 100 characters." }, 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ success: false, message: "Your cart is empty." }, 400);
    }
    if (payment_method !== "upi" && payment_method !== "cod") {
      return jsonResponse({ success: false, message: "Invalid payment method." }, 400);
    }
    const maxQty = type === "bulk" ? 500 : 50;
    for (const it of items) {
      if (!it || typeof it.id !== "string" || !Number.isInteger(it.qty) || it.qty <= 0 || it.qty > maxQty) {
        return jsonResponse({ success: false, message: "Invalid item in cart." }, 400);
      }
    }
    if (type === "bulk" && !delivery_datetime) {
      return jsonResponse({ success: false, message: "Delivery date & time is required." }, 400);
    }
    if (type === "normal" && (!delivery_slot || typeof delivery_slot !== "string")) {
      return jsonResponse({ success: false, message: "Please select a delivery slot." }, 400);
    }

    const ordersTable = type === "normal" ? "normal_orders" : "bulk_orders";
    const itemsTable = type === "normal" ? "normal_order_items" : "bulk_order_items";

    // ---- idempotency: if this key was already used, return that order
    const { data: existing } = await supabase
      .from(ordersTable)
      .select("order_number, total")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        success: true,
        order_number: existing.order_number,
        total: existing.total,
        duplicate: true,
      });
    }

    // ---- look up REAL prices from the DB — never trust the client ----
    const productIds = items.map((i: { id: string }) => i.id);
    const { data: products, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, active, order_type")
      .in("id", productIds)
      .eq("order_type", type);

    if (productErr) {
      console.error("product lookup failed", productErr);
      return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
    }

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const lineItems: { product_id: string; product_name: string; unit_price: number; quantity: number; line_total: number }[] = [];
    let subtotal = 0;

    for (const it of items) {
      const product = productMap.get(it.id);
      if (!product || !product.active) {
        return jsonResponse({ success: false, message: "One or more items in your cart are no longer available." }, 400);
      }
      const lineTotal = Number(product.price) * it.qty;
      subtotal += lineTotal;
      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: Number(product.price),
        quantity: it.qty,
        line_total: lineTotal,
      });
    }

    // Coupon system isn't built yet (matches the TODO already in the
    // frontend code) — discount stays 0 for now regardless of what's sent.
    const discount = 0;
    const total = subtotal - discount;

    // ---- find or create the customer, by phone -----------------------
    const cleanPhone = String(phone).trim();
    const { data: customer, error: customerErr } = await supabase
      .from("customers")
      .upsert(
        { phone: cleanPhone, name: name.trim() },
        { onConflict: "phone", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (customerErr || !customer) {
      console.error("customer upsert failed", customerErr);
      return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
    }

    // ---- insert the order ----------------------------------------------
    const orderRow: Record<string, unknown> = {
      customer_id: customer.id,
      name: name.trim(),
      phone: cleanPhone,
      address: String(address).trim(),
      notes: notes ? String(notes).trim() : null,
      subtotal,
      coupon_code: coupon_code || null,
      discount,
      total,
      payment_method,
      payment_status: "pending", // UPI is self-reported, COD is uncollected — both start pending
      idempotency_key,
    };
    if (type === "bulk") {
      orderRow.event_type = event_type ? String(event_type).trim() : null;
      orderRow.delivery_datetime = delivery_datetime;
    } else {
      orderRow.delivery_slot = delivery_slot;
    }

    const { data: order, error: orderErr } = await supabase
      .from(ordersTable)
      .insert(orderRow)
      .select("id, order_number, total")
      .single();

    if (orderErr || !order) {
      console.error("order insert failed", orderErr);
      return jsonResponse({ success: false, message: "Could not place your order. Please try again." }, 500);
    }

    // ---- insert order items ---------------------------------------------
    const { error: itemsErr } = await supabase
      .from(itemsTable)
      .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));

    if (itemsErr) {
      console.error("order items insert failed", itemsErr);
      // Order header already exists — log for manual follow-up rather than
      // leaving the customer with a failed request for a real order.
      return jsonResponse({ success: false, message: "Could not save your order items. Please contact us with your order confirmation." }, 500);
    }

    return jsonResponse({ success: true, order_number: order.order_number, total: order.total });
  } catch (err) {
    console.error("place-order unexpected error", err);
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

// =====================================================================
// order-status — The Chinese Bliss customer order tracking API
//
// Public customer lookup for NORMAL direct website orders only.
// Authentication is possession-based: exact order number + exact customer
// mobile number. The function returns only fields required for customer
// tracking and never exposes the delivery address, customer name, internal
// database ids, admin audit data, or restaurant-only notes.
//
// Deploy with JWT verification disabled because customers are not required
// to create Supabase accounts. The function performs its own strict lookup.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to the production website origin before launch
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
const ORDER_RE = /^[A-Za-z0-9_-]{3,80}$/;

function cleanOrderNumber(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, message: "Order tracking is temporarily unavailable." }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderNumber = cleanOrderNumber(body?.order_number);
    const phone = cleanPhone(body?.phone);

    if (!ORDER_RE.test(orderNumber) || !PHONE_RE.test(phone)) {
      return jsonResponse({ success: false, message: "Enter a valid order number and 10-digit mobile number." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: order, error: orderError } = await admin
      .from("normal_orders")
      .select([
        "id",
        "order_number",
        "created_at",
        "order_status",
        "payment_status",
        "payment_method",
        "subtotal",
        "discount",
        "delivery_fee",
        "total",
        "delivery_slot",
        "estimated_delivery_from",
        "estimated_delivery_to",
        "delivery_provider",
        "tracking_url",
        "accepted_at",
        "preparing_at",
        "ready_at",
        "rider_assigned_at",
        "dispatched_at",
        "delivered_at",
        "rejected_at",
        "rejection_reason",
        "cancelled_at",
        "cancellation_reason"
      ].join(","))
      .eq("order_number", orderNumber)
      .eq("phone", phone)
      .maybeSingle();

    // Deliberately use the same response for not-found and mismatched phone.
    if (orderError || !order) {
      if (orderError) console.error("order-status lookup failed", orderError);
      return jsonResponse({ success: false, message: "Order not found. Check the order number and mobile number and try again." }, 404);
    }

    const { data: items, error: itemsError } = await admin
      .from("normal_order_items")
      .select("product_name, quantity, unit_price, line_total")
      .eq("order_id", order.id)
      .order("id", { ascending: true });

    if (itemsError) {
      console.error("order-status item lookup failed", itemsError);
      return jsonResponse({ success: false, message: "Order tracking is temporarily unavailable." }, 500);
    }

    return jsonResponse({
      success: true,
      order: {
        order_number: order.order_number,
        created_at: order.created_at,
        order_status: order.order_status || "new",
        payment_status: order.payment_status || "pending",
        payment_method: order.payment_method,
        subtotal: order.subtotal,
        discount: order.discount,
        delivery_fee: order.delivery_fee,
        total: order.total,
        delivery_slot: order.delivery_slot,
        estimated_delivery_from: order.estimated_delivery_from,
        estimated_delivery_to: order.estimated_delivery_to,
        delivery_provider: order.delivery_provider,
        tracking_url: order.tracking_url,
        accepted_at: order.accepted_at,
        preparing_at: order.preparing_at,
        ready_at: order.ready_at,
        rider_assigned_at: order.rider_assigned_at,
        dispatched_at: order.dispatched_at,
        delivered_at: order.delivered_at,
        rejected_at: order.rejected_at,
        rejection_reason: order.rejection_reason,
        cancelled_at: order.cancelled_at,
        cancellation_reason: order.cancellation_reason,
        items: items ?? [],
      },
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("order-status unexpected error", err);
    return jsonResponse({ success: false, message: "Order tracking is temporarily unavailable." }, 500);
  }
});

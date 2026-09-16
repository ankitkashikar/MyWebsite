// =====================================================================
// order-status — The Chinese Bliss customer order tracking API
//
// Public NORMAL-order lookup using order number + customer phone.
// It returns only customer-safe fields. Address, name, internal ids,
// restaurant notes, rejection reasons and admin audit data stay private.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  RequestError,
  enforceRateLimit,
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
  rateLimitKey,
  readJsonBody,
  requestIp,
  validHttpUrl,
} from "../_shared/tcb-security.ts";

const PHONE_RE = /^[6-9][0-9]{9}$/;
const ORDER_RE = /^[A-Za-z0-9_-]{3,80}$/;

function cleanOrderNumber(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return jsonResponse(req, { success: false, message: "Origin not allowed." }, 403);
  if (req.method !== "POST") return jsonResponse(req, { success: false, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { success: false, message: "Order tracking is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await readJsonBody(req, 4_000);
    const orderNumber = cleanOrderNumber(body.order_number);
    const phone = cleanPhone(body.phone);

    if (!ORDER_RE.test(orderNumber) || !PHONE_RE.test(phone)) {
      return jsonResponse(req, { success: false, message: "Enter a valid order number and 10-digit mobile number." }, 400);
    }

    const ipKey = await rateLimitKey("order-status-ip", requestIp(req));
    const lookupKey = await rateLimitKey("order-status-pair", `${orderNumber}:${phone}`);
    await enforceRateLimit(admin, "order-status-ip", ipKey, 30, 600);
    await enforceRateLimit(admin, "order-status-pair", lookupKey, 12, 600);

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
        "cancelled_at"
      ].join(","))
      .eq("order_number", orderNumber)
      .eq("phone", phone)
      .maybeSingle();

    if (orderError || !order) {
      if (orderError) console.error("order-status lookup failed", orderError);
      return jsonResponse(req, { success: false, message: "Order not found. Check the order number and mobile number and try again." }, 404);
    }

    const { data: items, error: itemsError } = await admin
      .from("normal_order_items")
      .select("product_name, quantity, unit_price, line_total")
      .eq("order_id", order.id)
      .order("id", { ascending: true });

    if (itemsError) {
      console.error("order-status item lookup failed", itemsError);
      return jsonResponse(req, { success: false, message: "Order tracking is temporarily unavailable." }, 500);
    }

    return jsonResponse(req, {
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
        tracking_url: validHttpUrl(order.tracking_url),
        accepted_at: order.accepted_at,
        preparing_at: order.preparing_at,
        ready_at: order.ready_at,
        rider_assigned_at: order.rider_assigned_at,
        dispatched_at: order.dispatched_at,
        delivered_at: order.delivered_at,
        rejected_at: order.rejected_at,
        cancelled_at: order.cancelled_at,
        items: items ?? [],
      },
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof RequestError) return jsonResponse(req, { success: false, message: err.message }, err.status);
    console.error("order-status unexpected error", err);
    return jsonResponse(req, { success: false, message: "Order tracking is temporarily unavailable." }, 500);
  }
});

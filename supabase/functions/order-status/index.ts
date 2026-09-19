// =====================================================================
// order-status — The Chinese Bliss customer order tracking API
//
// Security model:
// - Public customer lookup for NORMAL direct website orders only.
// - Customers do not need a Supabase account; deploy with verify_jwt=false.
// - Possession check requires exact TCB order number + exact customer phone.
// - Service-role credentials remain server-side only.
// - Requests are origin-locked for browsers, size-limited and rate-limited.
// - Responses expose only customer-safe tracking fields.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";
const MAX_BODY_BYTES = 8 * 1024;
const PHONE_RE = /^[6-9][0-9]{9}$/;
const ORDER_RE = /^CBD-[0-9]{4}-[0-9]{6}$/;

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

function cleanOrderNumber(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function cleanPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
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
    console.error("order-status rate limit check failed", error);
    return false;
  }
  return data === true;
}

function customerSafeTrackingUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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
    return jsonResponse({ success: false, message: "Order tracking is temporarily unavailable." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const ip = clientIp(req);
    const ipRateKey = await sha256(`order-status:ip:${ip}`);
    if (!(await consumeRateLimit(admin, ipRateKey, 30, 600))) {
      return jsonResponse({
        success: false,
        message: "Too many order lookup attempts. Please wait a few minutes and try again.",
      }, 429);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, message: "Invalid request." }, 400);
    }

    const orderNumber = cleanOrderNumber(body?.order_number);
    const phone = cleanPhone(body?.phone);

    if (!ORDER_RE.test(orderNumber) || !PHONE_RE.test(phone)) {
      return jsonResponse({ success: false, message: "Enter a valid order number and 10-digit mobile number." }, 400);
    }

    // Limit repeated phone guesses against the same order from one network.
    const orderRateKey = await sha256(`order-status:order:${ip}:${orderNumber}`);
    if (!(await consumeRateLimit(admin, orderRateKey, 8, 600))) {
      return jsonResponse({
        success: false,
        message: "Too many attempts for this order. Please wait a few minutes and try again.",
      }, 429);
    }

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
        "cancelled_at",
      ].join(","))
      .eq("order_number", orderNumber)
      .eq("phone", phone)
      .maybeSingle();

    // Deliberately use the same response for an unknown order and wrong phone.
    if (orderError || !order) {
      if (orderError) console.error("order-status lookup failed", orderError);
      return jsonResponse({
        success: false,
        message: "Order not found. Check the order number and mobile number and try again.",
      }, 404);
    }

    const { data: items, error: itemsError } = await admin
      .from("normal_order_items")
      .select("product_name,quantity,unit_price,line_total")
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
        tracking_url: customerSafeTrackingUrl(order.tracking_url),
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
    console.error("order-status unexpected error", err);
    return jsonResponse({ success: false, message: "Order tracking is temporarily unavailable." }, 500);
  }
});

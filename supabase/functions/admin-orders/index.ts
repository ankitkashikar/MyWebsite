// =====================================================================
// admin-orders — The Chinese Bliss restaurant operations API
//
// Security model:
// - Platform JWT verification must remain enabled when deployed.
// - Browser signs in with Supabase Auth and sends the user JWT.
// - Handler re-validates the JWT and allows only TCB_ADMIN_EMAIL.
// - Database reads/writes use service_role only after authorization succeeds.
// - Responses are explicit, non-cacheable, origin-locked and rate-limited.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";
const MAX_BODY_BYTES = 32 * 1024;

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

type OrderType = "normal" | "bulk";
type OrderStatus =
  | "new"
  | "accepted"
  | "rejected"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "dispatched"
  | "delivered"
  | "cancelled";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  rejected: [],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["rider_assigned", "dispatched", "cancelled"],
  rider_assigned: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: [],
};

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
  accepted: "accepted_at",
  rejected: "rejected_at",
  preparing: "preparing_at",
  ready_for_pickup: "ready_at",
  rider_assigned: "rider_assigned_at",
  dispatched: "dispatched_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

const ORDER_SELECT = [
  "id", "order_number", "customer_id", "name", "phone", "address", "pincode", "notes",
  "subtotal", "coupon_code", "discount", "delivery_fee", "total", "payment_method", "payment_status",
  "delivery_slot", "event_type", "delivery_datetime", "created_at", "order_status", "acknowledged_at",
  "accepted_at", "rejected_at", "rejection_reason", "preparing_at", "ready_at", "rider_assigned_at",
  "dispatched_at", "delivered_at", "cancelled_at", "cancellation_reason", "delivery_partner_cost",
  "delivery_provider", "delivery_booking_id", "tracking_url", "rider_name", "rider_phone",
  "estimated_delivery_from", "estimated_delivery_to", "payment_reference", "paid_at", "updated_at",
].join(",");

const ITEM_SELECT = "id,order_id,product_id,product_name,unit_price,quantity,line_total";

function tableNames(type: OrderType) {
  return type === "normal"
    ? { orders: "normal_orders", items: "normal_order_items" }
    : { orders: "bulk_orders", items: "bulk_order_items" };
}

function isOrderType(value: unknown): value is OrderType {
  return value === "normal" || value === "bulk";
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && value in ALLOWED_TRANSITIONS;
}

function configuredAdminEmail(): string {
  return (Deno.env.get("TCB_ADMIN_EMAIL") ?? "").trim().toLowerCase();
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  ).trim().slice(0, 80);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    console.error("admin-orders rate limit check failed", error);
    return false;
  }
  return data === true;
}

function cleanOrderId(value: unknown): string {
  return String(value ?? "").trim().slice(0, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, message: "Method not allowed." }, 405);

  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return jsonResponse({ success: false, message: "Content-Type must be application/json." }, 415);
  }
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, message: "Request is too large." }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, message: "Server configuration is incomplete." }, 500);
  }

  const adminEmail = configuredAdminEmail();
  if (!adminEmail) return jsonResponse({ success: false, message: "Admin access is not configured yet." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonResponse({ success: false, message: "Sign in required." }, 401);
  const token = authHeader.slice(7).trim();
  if (!token) return jsonResponse({ success: false, message: "Sign in required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const user = authData?.user;
  const email = user?.email?.trim().toLowerCase() ?? "";
  if (authError || !user) return jsonResponse({ success: false, message: "Your admin session is invalid or expired." }, 401);
  if (!email || email !== adminEmail) {
    return jsonResponse({ success: false, message: "This is not the authorized TCB operations account." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const rateKey = await sha256(`admin-orders:${user.id}:${clientIp(req)}`);
    if (!(await consumeRateLimit(admin, rateKey, 300, 600))) {
      return jsonResponse({ success: false, message: "Too many requests. Please wait and try again." }, 429);
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "list") {
      const requestedType = body?.order_type;
      const types: OrderType[] = requestedType === "all"
        ? ["normal", "bulk"]
        : isOrderType(requestedType) ? [requestedType] : ["normal"];
      const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 200);
      const result: Record<string, unknown>[] = [];

      for (const type of types) {
        const names = tableNames(type);
        const { data: orders, error: ordersError } = await admin
          .from(names.orders)
          .select(ORDER_SELECT)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (ordersError) {
          console.error(`admin list ${type} orders failed`, ordersError);
          return jsonResponse({ success: false, message: "Could not load orders." }, 500);
        }

        const orderIds = (orders ?? []).map((o: Record<string, unknown>) => o.id).filter(Boolean);
        let items: Record<string, unknown>[] = [];
        if (orderIds.length > 0) {
          const { data: itemRows, error: itemsError } = await admin
            .from(names.items)
            .select(ITEM_SELECT)
            .in("order_id", orderIds);
          if (itemsError) {
            console.error(`admin list ${type} items failed`, itemsError);
            return jsonResponse({ success: false, message: "Could not load order items." }, 500);
          }
          items = (itemRows ?? []) as Record<string, unknown>[];
        }

        const byOrder = new Map<string, Record<string, unknown>[]>();
        for (const item of items) {
          const key = String(item.order_id ?? "");
          const list = byOrder.get(key) ?? [];
          list.push(item);
          byOrder.set(key, list);
        }

        for (const order of orders ?? []) {
          result.push({ ...order, order_type: type, items: byOrder.get(String(order.id)) ?? [] });
        }
      }

      result.sort((a: any, b: any) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0));
      return jsonResponse({ success: true, orders: result.slice(0, limit), server_time: new Date().toISOString() });
    }

    if (action === "confirm_payment") {
      const type = body?.order_type;
      const orderId = cleanOrderId(body?.order_id);
      if (!isOrderType(type) || !orderId) return jsonResponse({ success: false, message: "Invalid order." }, 400);

      const names = tableNames(type);
      const { data: order, error: fetchError } = await admin
        .from(names.orders)
        .select("id,order_number,payment_status")
        .eq("id", orderId)
        .single();
      if (fetchError || !order) return jsonResponse({ success: false, message: "Order not found." }, 404);
      if (order.payment_status === "paid") return jsonResponse({ success: true, order, duplicate: true });
      if (order.payment_status !== "pending") {
        return jsonResponse({ success: false, message: "This payment cannot be confirmed from its current state." }, 409);
      }

      const update: Record<string, unknown> = {
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (body?.payment_reference) update.payment_reference = String(body.payment_reference).trim().slice(0, 120);

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .eq("payment_status", "pending")
        .select(ORDER_SELECT)
        .single();
      if (updateError || !updated) {
        console.error("confirm payment failed", updateError);
        return jsonResponse({ success: false, message: "Could not confirm payment." }, 500);
      }
      return jsonResponse({ success: true, order: updated });
    }

    if (action === "set_delivery") {
      const type = body?.order_type;
      const orderId = cleanOrderId(body?.order_id);
      if (!isOrderType(type) || !orderId) return jsonResponse({ success: false, message: "Invalid order." }, 400);

      const names = tableNames(type);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fields = ["delivery_provider", "delivery_booking_id", "tracking_url", "rider_name", "rider_phone"];
      for (const field of fields) {
        if (body?.[field] !== undefined) {
          const value = String(body[field] ?? "").trim();
          update[field] = value ? value.slice(0, 500) : null;
        }
      }
      if (body?.tracking_url) {
        try {
          const url = new URL(String(body.tracking_url).trim());
          if (url.protocol !== "https:") return jsonResponse({ success: false, message: "Tracking URL must use HTTPS." }, 400);
        } catch {
          return jsonResponse({ success: false, message: "Invalid tracking URL." }, 400);
        }
      }
      if (body?.delivery_partner_cost !== undefined) {
        const cost = Number(body.delivery_partner_cost);
        if (!Number.isFinite(cost) || cost < 0 || cost > 5000) {
          return jsonResponse({ success: false, message: "Invalid delivery partner cost." }, 400);
        }
        update.delivery_partner_cost = cost;
      }

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .select(ORDER_SELECT)
        .single();
      if (updateError || !updated) {
        console.error("set delivery failed", updateError);
        return jsonResponse({ success: false, message: "Could not save delivery details." }, 500);
      }
      return jsonResponse({ success: true, order: updated });
    }

    if (action === "update_status") {
      const type = body?.order_type;
      const orderId = cleanOrderId(body?.order_id);
      const nextStatus = body?.status;
      const reason = body?.reason ? String(body.reason).trim().slice(0, 500) : "";
      if (!isOrderType(type) || !orderId || !isOrderStatus(nextStatus)) {
        return jsonResponse({ success: false, message: "Invalid status update." }, 400);
      }
      if ((nextStatus === "rejected" || nextStatus === "cancelled") && reason.length < 3) {
        return jsonResponse({ success: false, message: "Please record a reason." }, 400);
      }

      const names = tableNames(type);
      const { data: current, error: currentError } = await admin
        .from(names.orders)
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .single();
      if (currentError || !current) return jsonResponse({ success: false, message: "Order not found." }, 404);

      const currentStatus = (current.order_status || "new") as OrderStatus;
      if (!isOrderStatus(currentStatus)) return jsonResponse({ success: false, message: "Order has an unsupported legacy status." }, 409);
      if (currentStatus === nextStatus) return jsonResponse({ success: true, order: current, duplicate: true });
      if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
        return jsonResponse({ success: false, message: `Cannot move an order from ${currentStatus} to ${nextStatus}.` }, 409);
      }
      if (nextStatus === "accepted" && current.payment_status !== "paid") {
        return jsonResponse({ success: false, message: "Confirm payment before accepting this direct website order." }, 409);
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = { order_status: nextStatus, updated_at: now };
      if (!current.acknowledged_at) update.acknowledged_at = now;
      const timestampField = STATUS_TIMESTAMP[nextStatus];
      if (timestampField) update[timestampField] = now;
      if (nextStatus === "rejected") update.rejection_reason = reason;
      if (nextStatus === "cancelled") update.cancellation_reason = reason;

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .eq("order_status", currentStatus)
        .select(ORDER_SELECT)
        .single();
      if (updateError || !updated) {
        console.error("status update failed", updateError);
        return jsonResponse({ success: false, message: "Could not update order status." }, 409);
      }

      const { error: eventError } = await admin.from("order_status_events").insert({
        order_type: type,
        order_id: String(orderId),
        order_number: updated.order_number ? String(updated.order_number) : null,
        previous_status: currentStatus,
        new_status: nextStatus,
        reason: reason || null,
        changed_by: email,
      });
      if (eventError) console.error("status event audit insert failed", eventError);
      return jsonResponse({ success: true, order: updated });
    }

    return jsonResponse({ success: false, message: "Unsupported action." }, 400);
  } catch (err) {
    console.error("admin-orders unexpected error", err);
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

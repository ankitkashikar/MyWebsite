// =====================================================================
// admin-orders — The Chinese Bliss restaurant operations API
//
// Security model:
// - Browser signs in with Supabase Auth.
// - This function validates the JWT server-side.
// - Exactly one shared TCB operations email in TCB_ADMIN_EMAIL is allowed.
// - Browser roles never receive database write access.
// - All reads/writes use the server-only service role after authorization.
// - Strict server-side lifecycle transitions prevent DevTools tampering.
// - Sensitive changes are written to audit tables.
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
  validHttpUrl,
} from "../_shared/tcb-security.ts";

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

async function auditAdminAction(
  admin: ReturnType<typeof createClient>,
  values: {
    order_type: OrderType;
    order_id: string;
    order_number?: string | null;
    action: string;
    changed_by: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("order_admin_events").insert({
    order_type: values.order_type,
    order_id: values.order_id,
    order_number: values.order_number ?? null,
    action: values.action,
    changed_by: values.changed_by,
    metadata: values.metadata ?? {},
  });
  if (error) console.error("admin audit insert failed", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return jsonResponse(req, { success: false, message: "Origin not allowed." }, 403);
  if (req.method !== "POST") return jsonResponse(req, { success: false, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = configuredAdminEmail();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmail) {
    return jsonResponse(req, { success: false, message: "Admin service is not configured." }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(req, { success: false, message: "Sign in required." }, 401);
  }

  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const user = authData?.user;
  const email = user?.email?.trim().toLowerCase() ?? "";

  if (authError || !user) {
    return jsonResponse(req, { success: false, message: "Your admin session is invalid or expired." }, 401);
  }
  if (!user.email_confirmed_at || !email || email !== adminEmail) {
    return jsonResponse(req, { success: false, message: "This is not the authorized TCB operations account." }, 403);
  }

  const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (aalError || aalData?.currentLevel !== "aal2") {
    return jsonResponse(req, { success: false, message: "Authenticator verification is required for TCB Order Console access." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const adminRateKey = await rateLimitKey("admin-user", user.id);
    await enforceRateLimit(admin, "admin-user", adminRateKey, 240, 60);

    const body = await readJsonBody(req, 32_000);
    const action = body.action;

    if (action === "list") {
      const requestedType = body.order_type;
      const types: OrderType[] = requestedType === "all"
        ? ["normal", "bulk"]
        : isOrderType(requestedType)
          ? [requestedType]
          : ["normal"];
      const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 200);
      const result: Record<string, unknown>[] = [];

      for (const type of types) {
        const names = tableNames(type);
        const { data: orderRows, error: ordersError } = await admin
          .from(names.orders)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (ordersError) {
          console.error(`admin list ${type} orders failed`, ordersError);
          return jsonResponse(req, { success: false, message: "Could not load orders." }, 500);
        }

        const orderIds = (orderRows ?? []).map((o: Record<string, unknown>) => o.id).filter(Boolean);
        let items: Record<string, unknown>[] = [];
        if (orderIds.length) {
          const { data: itemRows, error: itemsError } = await admin
            .from(names.items)
            .select("*")
            .in("order_id", orderIds);
          if (itemsError) {
            console.error(`admin list ${type} items failed`, itemsError);
            return jsonResponse(req, { success: false, message: "Could not load order items." }, 500);
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

        for (const order of orderRows ?? []) {
          result.push({ ...order, order_type: type, items: byOrder.get(String(order.id)) ?? [] });
        }
      }

      result.sort((a, b) => (Date.parse(String(b.created_at ?? "")) || 0) - (Date.parse(String(a.created_at ?? "")) || 0));
      return jsonResponse(req, { success: true, orders: result.slice(0, limit), server_time: new Date().toISOString() });
    }

    if (action === "confirm_payment") {
      const type = body.order_type;
      const orderId = cleanText(body.order_id, 120);
      if (!isOrderType(type) || !orderId) return jsonResponse(req, { success: false, message: "Invalid order." }, 400);

      const names = tableNames(type);
      const { data: order, error: fetchError } = await admin
        .from(names.orders)
        .select("id, order_number, payment_status")
        .eq("id", orderId)
        .single();
      if (fetchError || !order) return jsonResponse(req, { success: false, message: "Order not found." }, 404);
      if (order.payment_status === "paid") return jsonResponse(req, { success: true, order, duplicate: true });
      if (order.payment_status && !["pending", "payment_pending"].includes(String(order.payment_status))) {
        return jsonResponse(req, { success: false, message: "This payment state cannot be manually confirmed." }, 409);
      }

      const paymentReference = cleanText(body.payment_reference, 120);
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update({
          payment_status: "paid",
          paid_at: now,
          updated_at: now,
          payment_reference: paymentReference || null,
        })
        .eq("id", orderId)
        .eq("payment_status", order.payment_status)
        .select("*")
        .maybeSingle();

      if (updateError) {
        console.error("confirm payment failed", updateError);
        return jsonResponse(req, { success: false, message: "Could not confirm payment." }, 500);
      }
      if (!updated) return jsonResponse(req, { success: false, message: "Order changed on another device. Refresh and try again." }, 409);

      await auditAdminAction(admin, {
        order_type: type,
        order_id: String(orderId),
        order_number: updated.order_number ? String(updated.order_number) : null,
        action: "payment_verified",
        changed_by: email,
        metadata: { payment_reference: paymentReference || null },
      });

      return jsonResponse(req, { success: true, order: updated });
    }

    if (action === "set_delivery") {
      const type = body.order_type;
      const orderId = cleanText(body.order_id, 120);
      if (!isOrderType(type) || !orderId) return jsonResponse(req, { success: false, message: "Invalid order." }, 400);

      const provider = cleanText(body.delivery_provider, 120);
      if (!provider) return jsonResponse(req, { success: false, message: "Delivery provider is required." }, 400);

      const trackingRaw = cleanText(body.tracking_url, 500);
      const trackingUrl = trackingRaw ? validHttpUrl(trackingRaw) : null;
      if (trackingRaw && !trackingUrl) return jsonResponse(req, { success: false, message: "Tracking URL must use http or https." }, 400);

      const riderPhone = cleanText(body.rider_phone, 20);
      if (riderPhone && !/^\+?[0-9()\-\s]{6,20}$/.test(riderPhone)) {
        return jsonResponse(req, { success: false, message: "Invalid rider phone number." }, 400);
      }

      const cost = body.delivery_partner_cost === undefined || body.delivery_partner_cost === ""
        ? null
        : Number(body.delivery_partner_cost);
      if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 5000)) {
        return jsonResponse(req, { success: false, message: "Invalid delivery partner cost." }, 400);
      }

      const names = tableNames(type);
      const update = {
        updated_at: new Date().toISOString(),
        delivery_provider: provider,
        delivery_booking_id: cleanText(body.delivery_booking_id, 160) || null,
        tracking_url: trackingUrl,
        rider_name: cleanText(body.rider_name, 120) || null,
        rider_phone: riderPhone || null,
        delivery_partner_cost: cost,
      };

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .select("*")
        .single();
      if (updateError || !updated) {
        console.error("set delivery failed", updateError);
        return jsonResponse(req, { success: false, message: "Could not save delivery details." }, 500);
      }

      await auditAdminAction(admin, {
        order_type: type,
        order_id: String(orderId),
        order_number: updated.order_number ? String(updated.order_number) : null,
        action: "delivery_details_updated",
        changed_by: email,
        metadata: {
          delivery_provider: provider,
          delivery_booking_id: update.delivery_booking_id,
          delivery_partner_cost: cost,
        },
      });

      return jsonResponse(req, { success: true, order: updated });
    }

    if (action === "update_status") {
      const type = body.order_type;
      const orderId = cleanText(body.order_id, 120);
      const nextStatus = body.status;
      const reason = cleanText(body.reason, 500);
      if (!isOrderType(type) || !orderId || !isOrderStatus(nextStatus)) {
        return jsonResponse(req, { success: false, message: "Invalid status update." }, 400);
      }
      if ((nextStatus === "rejected" || nextStatus === "cancelled") && reason.length < 3) {
        return jsonResponse(req, { success: false, message: "Please record a reason." }, 400);
      }

      const names = tableNames(type);
      const { data: current, error: currentError } = await admin
        .from(names.orders)
        .select("*")
        .eq("id", orderId)
        .single();
      if (currentError || !current) return jsonResponse(req, { success: false, message: "Order not found." }, 404);

      const currentStatus = (current.order_status || "new") as OrderStatus;
      if (!isOrderStatus(currentStatus)) return jsonResponse(req, { success: false, message: "Order has an unsupported legacy status." }, 409);
      if (currentStatus === nextStatus) return jsonResponse(req, { success: true, order: current, duplicate: true });
      if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
        return jsonResponse(req, { success: false, message: `Cannot move an order from ${currentStatus} to ${nextStatus}.` }, 409);
      }
      if (nextStatus === "accepted" && current.payment_status !== "paid") {
        return jsonResponse(req, { success: false, message: "Confirm payment before accepting this direct website order." }, 409);
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
        .select("*")
        .maybeSingle();

      if (updateError) {
        console.error("status update failed", updateError);
        return jsonResponse(req, { success: false, message: "Could not update order status." }, 500);
      }
      if (!updated) return jsonResponse(req, { success: false, message: "Order changed on another device. Refresh and try again." }, 409);

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

      return jsonResponse(req, { success: true, order: updated });
    }

    return jsonResponse(req, { success: false, message: "Unsupported action." }, 400);
  } catch (err) {
    if (err instanceof RequestError) return jsonResponse(req, { success: false, message: err.message }, err.status);
    console.error("admin-orders unexpected error", err);
    return jsonResponse(req, { success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

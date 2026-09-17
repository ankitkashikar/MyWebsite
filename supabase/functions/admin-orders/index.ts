// =====================================================================
// admin-orders — The Chinese Bliss restaurant operations API
//
// Auth model:
// - Browser signs in with Supabase Auth (email/password).
// - This function validates the user's JWT with Supabase Auth.
// - Exactly one shared TCB operations email in TCB_ADMIN_EMAIL may read/update orders.
// - All database reads/writes happen server-side with the service role.
//
// Required secret:
//   TCB_ADMIN_EMAIL=orders@thechinesebliss.example
//
// Deploy with:
//   supabase functions deploy admin-orders
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ankitkashikar.github.io"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, message: "Server configuration is incomplete." }, 500);
  }

  const adminEmail = configuredAdminEmail();
  if (!adminEmail) {
    return jsonResponse({ success: false, message: "Admin access is not configured yet." }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Sign in required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  const email = user?.email?.trim().toLowerCase() ?? "";

  if (authError || !user) {
    return jsonResponse({ success: false, message: "Your admin session is invalid or expired." }, 401);
  }
  if (!email || email !== adminEmail) {
    return jsonResponse({ success: false, message: "This is not the authorized TCB operations account." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // -----------------------------------------------------------------
    // List recent orders with their item rows.
    // -----------------------------------------------------------------
    if (action === "list") {
      const requestedType = body?.order_type;
      const types: OrderType[] = requestedType === "all"
        ? ["normal", "bulk"]
        : isOrderType(requestedType)
          ? [requestedType]
          : ["normal"];
      const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 200);
      const result: unknown[] = [];

      for (const type of types) {
        const names = tableNames(type);
        const { data: orders, error: ordersError } = await admin
          .from(names.orders)
          .select("*")
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
            .select("*")
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
          result.push({
            ...order,
            order_type: type,
            items: byOrder.get(String(order.id)) ?? [],
          });
        }
      }

      result.sort((a: any, b: any) => {
        const ta = Date.parse(a.created_at ?? "") || 0;
        const tb = Date.parse(b.created_at ?? "") || 0;
        return tb - ta;
      });

      return jsonResponse({ success: true, orders: result.slice(0, limit), server_time: new Date().toISOString() });
    }

    // -----------------------------------------------------------------
    // Confirm manually verified payment. Future payment-gateway webhooks
    // should update payment state independently of this admin action.
    // -----------------------------------------------------------------
    if (action === "confirm_payment") {
      const type = body?.order_type;
      const orderId = body?.order_id;
      if (!isOrderType(type) || !orderId) {
        return jsonResponse({ success: false, message: "Invalid order." }, 400);
      }

      const names = tableNames(type);
      const { data: order, error: fetchError } = await admin
        .from(names.orders)
        .select("id, order_number, payment_status")
        .eq("id", orderId)
        .single();
      if (fetchError || !order) {
        return jsonResponse({ success: false, message: "Order not found." }, 404);
      }
      if (order.payment_status === "paid") {
        return jsonResponse({ success: true, order, duplicate: true });
      }

      const update: Record<string, unknown> = {
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (body?.payment_reference) {
        update.payment_reference = String(body.payment_reference).trim().slice(0, 120);
      }

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .select("*")
        .single();
      if (updateError || !updated) {
        console.error("confirm payment failed", updateError);
        return jsonResponse({ success: false, message: "Could not confirm payment." }, 500);
      }

      return jsonResponse({ success: true, order: updated });
    }

    // -----------------------------------------------------------------
    // Record actual delivery-provider details/cost. delivery_fee is the
    // customer-facing charge finalized before payment; it must never be
    // silently changed here when Porter/Borzo/etc is booked later.
    // -----------------------------------------------------------------
    if (action === "set_delivery") {
      const type = body?.order_type;
      const orderId = body?.order_id;
      if (!isOrderType(type) || !orderId) {
        return jsonResponse({ success: false, message: "Invalid order." }, 400);
      }
      const names = tableNames(type);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fields = ["delivery_provider", "delivery_booking_id", "tracking_url", "rider_name", "rider_phone"];
      for (const field of fields) {
        if (body?.[field] !== undefined) {
          const value = String(body[field] ?? "").trim();
          update[field] = value ? value.slice(0, 500) : null;
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
        .select("*")
        .single();
      if (updateError || !updated) {
        console.error("set delivery failed", updateError);
        return jsonResponse({ success: false, message: "Could not save delivery details." }, 500);
      }
      return jsonResponse({ success: true, order: updated });
    }

    // -----------------------------------------------------------------
    // Advance order lifecycle with strict server-side transition rules.
    // -----------------------------------------------------------------
    if (action === "update_status") {
      const type = body?.order_type;
      const orderId = body?.order_id;
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
        .select("*")
        .eq("id", orderId)
        .single();
      if (currentError || !current) {
        return jsonResponse({ success: false, message: "Order not found." }, 404);
      }

      const currentStatus = (current.order_status || "new") as OrderStatus;
      if (!isOrderStatus(currentStatus)) {
        return jsonResponse({ success: false, message: "Order has an unsupported legacy status." }, 409);
      }
      if (currentStatus === nextStatus) {
        return jsonResponse({ success: true, order: current, duplicate: true });
      }
      if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
        return jsonResponse({
          success: false,
          message: `Cannot move an order from ${currentStatus} to ${nextStatus}.`,
        }, 409);
      }
      if (nextStatus === "accepted" && current.payment_status !== "paid") {
        return jsonResponse({
          success: false,
          message: "Confirm payment before accepting this direct website order.",
        }, 409);
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        order_status: nextStatus,
        updated_at: now,
      };
      if (!current.acknowledged_at) update.acknowledged_at = now;
      const timestampField = STATUS_TIMESTAMP[nextStatus];
      if (timestampField) update[timestampField] = now;
      if (nextStatus === "rejected") update.rejection_reason = reason;
      if (nextStatus === "cancelled") update.cancellation_reason = reason;

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .select("*")
        .single();
      if (updateError || !updated) {
        console.error("status update failed", updateError);
        return jsonResponse({ success: false, message: "Could not update order status." }, 500);
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
      if (eventError) {
        console.error("status event audit insert failed", eventError);
        // Do not roll back a successful operational state change, but surface
        // the audit failure in logs for manual investigation.
      }

      return jsonResponse({ success: true, order: updated });
    }

    return jsonResponse({ success: false, message: "Unsupported action." }, 400);
  } catch (err) {
    console.error("admin-orders unexpected error", err);
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

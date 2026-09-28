// =====================================================================
// admin-orders — The Chinese Bliss restaurant operations API
//
// Security model:
// - Deploy with platform JWT verification enabled.
// - Browser signs in with Supabase Auth and sends the user JWT.
// - Handler re-validates that JWT and allows only TCB_ADMIN_EMAIL.
// - Database reads/writes use service_role only after authorization succeeds.
// - Responses are origin-locked, non-cacheable, size-limited and rate-limited.
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

function baseResponse(body: unknown, status = 200) {
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

const COMMON_ORDER_FIELDS = [
  "id",
  "order_number",
  "name",
  "phone",
  "address",
  "notes",
  "subtotal",
  "coupon_code",
  "discount",
  "delivery_fee",
  "total",
  "payment_method",
  "payment_status",
  "created_at",
  "updated_at",
  "order_status",
  "acknowledged_at",
  "accepted_at",
  "rejected_at",
  "rejection_reason",
  "preparing_at",
  "ready_at",
  "rider_assigned_at",
  "dispatched_at",
  "delivered_at",
  "cancelled_at",
  "cancellation_reason",
  "delivery_partner_cost",
  "delivery_provider",
  "delivery_booking_id",
  "tracking_url",
  "rider_name",
  "rider_phone",
  "estimated_delivery_from",
  "estimated_delivery_to",
  "payment_reference",
  "paid_at",
];

const NORMAL_ONLY_FIELDS = ["pincode", "delivery_slot"];
const BULK_ONLY_FIELDS = ["event_type", "delivery_datetime"];
const ITEM_SELECT = "order_id,product_id,product_name,unit_price,quantity,line_total";

function orderSelect(type: OrderType): string {
  return [
    ...COMMON_ORDER_FIELDS,
    ...(type === "normal" ? NORMAL_ONLY_FIELDS : BULK_ONLY_FIELDS),
  ].join(",");
}

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

function cleanOrderId(value: unknown): string {
  return String(value ?? "").trim().slice(0, 100);
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
    /* Failure is logged by the response helper without customer or error payloads. */
    return false;
  }
  return data === true;
}

function cleanText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function customerSafeItems(items: Record<string, unknown>[]) {
  return items.map((item) => ({
    product_id: item.product_id ?? null,
    product_name: item.product_name ?? null,
    unit_price: item.unit_price ?? null,
    quantity: item.quantity ?? null,
    line_total: item.line_total ?? null,
  }));
}

Deno.serve(async (req) => {
  // Generated per request; never accept a caller-supplied support reference.
  const reference = crypto.randomUUID();
  const started = Date.now();
  function jsonResponse(body: unknown, status = 200) {
    if (status >= 400) {
      console.warn(JSON.stringify({event: "api_failure", endpoint: "admin-orders", reference,
        status, duration_ms: Date.now() - started}));
      if (body && typeof body === "object") {
        const result = body as Record<string, unknown>;
        body = {...result, reference,
          message: String(result.message || "Request could not be completed.") + " Reference: " + reference};
      }
    }
    return baseResponse(body, status);
  }

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
  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse({ success: false, message: "Sign in required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
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
    const rateKey = await sha256(`admin-orders:${user.id}:${clientIp(req)}`);
    if (!(await consumeRateLimit(admin, rateKey, 300, 600))) {
      return jsonResponse({ success: false, message: "Too many requests. Please wait and try again." }, 429);
    }

    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return jsonResponse({success:false,message:"Request is too large."},413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);let offset=0;
    for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.length; }
    let body;
    try { body=JSON.parse(new TextDecoder().decode(bytes)); } catch { body=null; }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ success: false, message: "Invalid JSON request." }, 400);
    }
    const action = body.action;

    if (action === "customers_list" || action === "customer_detail") {
      const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      if (action === "customers_list") {
        if ((body.search != null && (typeof body.search !== "string" || body.search.length > 100)) ||
            (body.after_id != null && !uuid(body.after_id))) {
          return jsonResponse({success:false,message:"Invalid customer search or page."},400);
        }
        const {data,error}=await admin.rpc("admin_customers_list",{p_search:(body.search??"").trim(),p_after:body.after_id??null});
        if(error)return jsonResponse({success:false,message:"Could not load customers."},500);
        return jsonResponse({success:true,...data});
      }
      const page = body.offset ?? 0;
      if (!uuid(body.customer_id) || !Number.isInteger(page) || page<0 || page>1000000) {
        return jsonResponse({success:false,message:"Invalid customer or page."},400);
      }
      const {data,error}=await admin.rpc("admin_customer_detail",{p_customer:body.customer_id,p_offset:page});
      if(error)return jsonResponse({success:false,message:"Could not load customer history."},500);
      if(!data)return jsonResponse({success:false,message:"Customer not found."},404);
      return jsonResponse({success:true,...data});
    }

    if (action === "coupon_list") {
      if (body.after_code != null && (typeof body.after_code !== "string" || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(body.after_code))) {
        return jsonResponse({success:false,message:"Invalid page cursor."},400);
      }
      let query=admin.from("coupons").select("code,active,kind,value,min_subtotal_paise,order_type,max_discount_paise,usage_limit,per_phone_limit,starts_at,ends_at,product_ids,categories,version").is("deleted_at",null).order("code").limit(101);
      if(body.after_code) query=query.gt("code",body.after_code);
      const {data,error}=await query;
      return error ? jsonResponse({success:false,message:"Could not load coupons."},500)
        : jsonResponse({success:true,coupons:(data??[]).slice(0,100),next_code:data?.length===101?data[99].code:null});
    }
    if (action === "coupon_history") {
      const {data,error}=await admin.from("coupon_admin_events").select("id,code,action,actor,before_coupon,after_coupon,created_at").order("id",{ascending:false}).limit(50);
      return error ? jsonResponse({success:false,message:"Could not load coupon history."},500) : jsonResponse({success:true,events:data});
    }
    if (["coupon_save","coupon_toggle","coupon_delete"].includes(action)) {
      const code=body.code;
      const changes=body.changes;
      if(typeof code!=="string" || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code) || !Number.isSafeInteger(body.version) || body.version<0) {
        return jsonResponse({success:false,message:"Invalid coupon code or version."},400);
      }
      if(action!=="coupon_delete") {
        if(!changes || typeof changes!=="object" || Array.isArray(changes) || typeof changes.active!=="boolean") return jsonResponse({success:false,message:"Invalid coupon settings."},400);
        const fields=action==="coupon_toggle"?["active"]:["active","kind","value","min_subtotal_paise","order_type","max_discount_paise","usage_limit","per_phone_limit"];
        if(Object.keys(changes).some(k=>!fields.includes(k))) return jsonResponse({success:false,message:"Unsupported coupon field."},400);
        if(action==="coupon_save") {
          const integer=(v:unknown,min:number,max:number)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
          if(!["flat","percent"].includes(changes.kind) || !integer(changes.value,1,changes.kind==="percent"?10000:9999999999) ||
            !integer(changes.min_subtotal_paise,0,9999999999) || (changes.order_type!==null&&!isOrderType(changes.order_type)) ||
            (changes.max_discount_paise!==null&&!integer(changes.max_discount_paise,1,9999999999)) ||
            [changes.usage_limit,changes.per_phone_limit].some(v=>v!==null&&!integer(v,1,2147483647))) {
            return jsonResponse({success:false,message:"Enter valid coupon amounts and limits."},400);
          }
        }
      }
      const {data,error}=await admin.rpc("manage_coupon",{p_code:code,p_action:action.slice(7),p_version:body.version,p_changes:action==="coupon_delete"?{}:changes,p_actor:user.id});
      return error ? jsonResponse({success:false,message:error.code==="P0002"?"Coupon changed. Reload before editing.":"Could not save coupon. Deleted codes cannot be reused."},error.code==="P0002"?409:400)
        : jsonResponse({success:true,coupon:data});
    }

    if (action === "delivery_list") {
      const {data, error} = await admin.from("delivery_rules").select("order_type,fee_paise,free_above_paise,enabled,deleted,version,updated_at");
      return error ? jsonResponse({success:false,message:"Could not load delivery settings."},500)
        : jsonResponse({success:true,rules:data});
    }
    if (action === "delivery_save" || action === "delivery_delete") {
      const money = (v: unknown) => Number.isSafeInteger(v) && Number(v)>=0 && Number(v)<=9999999999;
      if (!isOrderType(body.order_type) || !Number.isSafeInteger(body.version) || body.version<0 ||
          (action === "delivery_save" && (!money(body.fee_paise) ||
          (body.free_above_paise !== null && !money(body.free_above_paise)) || typeof body.enabled !== "boolean"))) {
        return jsonResponse({success:false,message:"Enter valid delivery settings."},400);
      }
      const {data,error} = await admin.rpc("manage_delivery_rule",{
        p_type:body.order_type,p_action:action === "delivery_delete" ? "delete" : "save",p_version:body.version,
        p_fee:action === "delivery_save" ? body.fee_paise : null,
        p_free:action === "delivery_save" ? body.free_above_paise : null,
        p_enabled:action === "delivery_save" ? body.enabled : false,p_actor:user.id,
      });
      return error ? jsonResponse({success:false,message:error.code === "P0002" ? "Settings changed. Reload before saving." : "Could not save delivery settings."},error.code === "P0002" ? 409 : 400)
        : jsonResponse({success:true,rule:data});
    }

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
        let orderQuery = admin.from(names.orders).select(orderSelect(type));
        if (body.needs_attention === true) orderQuery = orderQuery.eq("order_status","new").is("acknowledged_at",null);
        const { data: orders, error: ordersError } = await orderQuery
          .order("created_at", { ascending: body.needs_attention === true }).limit(limit);

        if (ordersError) {
          /* Failure is logged by the response helper without customer or error payloads. */
          return jsonResponse({ success: false, message: "Could not load orders." }, 500);
        }

        const orderIds = (orders ?? [])
          .map((order: Record<string, unknown>) => order.id)
          .filter(Boolean);
        let items: Record<string, unknown>[] = [];

        if (orderIds.length > 0) {
          const { data: itemRows, error: itemsError } = await admin
            .from(names.items)
            .select(ITEM_SELECT)
            .in("order_id", orderIds);
          if (itemsError) {
            /* Failure is logged by the response helper without customer or error payloads. */
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
          const orderItems = byOrder.get(String(order.id)) ?? [];
          result.push({
            ...order,
            order_type: type,
            items: customerSafeItems(orderItems),
          });
        }
      }

      result.sort((a: any, b: any) => {
        const aTime = Date.parse(a.created_at ?? "") || 0;
        const bTime = Date.parse(b.created_at ?? "") || 0;
        return body.needs_attention === true ? aTime - bTime : bTime - aTime;
      });

      let attention = null;
      if (body.include_attention === true) {
        const groups = [];
        for (const type of ["normal","bulk"] as OrderType[]) {
          const {data,count,error}=await admin.from(tableNames(type).orders)
            .select("created_at",{count:"exact"}).eq("order_status","new").is("acknowledged_at",null)
            .order("created_at",{ascending:true}).limit(1);
          if(error)return jsonResponse({success:false,message:"Could not check kitchen alerts."},500);
          groups.push({order_type:type,count:count??0,oldest_at:data?.[0]?.created_at??null});
        }
        attention = {groups};
      }
      return jsonResponse({
        success: true,
        attention,
        orders: result.slice(0, limit),
        server_time: new Date().toISOString(),
      });
    }

    if (action === "confirm_payment") {
      const type = body.order_type;
      const orderId = cleanOrderId(body.order_id);
      if (!isOrderType(type) || !orderId) {
        return jsonResponse({ success: false, message: "Invalid order." }, 400);
      }

      const names = tableNames(type);
      const { data: order, error: fetchError } = await admin
        .from(names.orders)
        .select("id,order_number,payment_status")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        return jsonResponse({ success: false, message: "Order not found." }, 404);
      }
      if (order.payment_status === "paid") {
        return jsonResponse({ success: true, order, duplicate: true });
      }
      if (order.payment_status !== "pending") {
        return jsonResponse({
          success: false,
          message: "This payment cannot be confirmed from its current state.",
        }, 409);
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        payment_status: "paid",
        paid_at: now,
        updated_at: now,
      };
      const paymentReference = cleanText(body.payment_reference, 120);
      if (paymentReference) update.payment_reference = paymentReference;

      const { data: updated, error: updateError } = await admin
        .from(names.orders)
        .update(update)
        .eq("id", orderId)
        .eq("payment_status", "pending")
        .select(orderSelect(type))
        .maybeSingle();

      if (updateError) {
        /* Failure is logged by the response helper without customer or error payloads. */
        return jsonResponse({ success: false, message: "Could not confirm payment." }, 500);
      }
      if (!updated) {
        return jsonResponse({ success: false, message: "Order changed. Refresh and try again." }, 409);
      }
      return jsonResponse({ success: true, order: updated });
    }

    if (action === "set_delivery") {
      const type = body.order_type;
      const orderId = cleanOrderId(body.order_id);
      if (!isOrderType(type) || !orderId) {
        return jsonResponse({ success: false, message: "Invalid order." }, 400);
      }

      const names = tableNames(type);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const textFields: Array<[string, number]> = [
        ["delivery_provider", 120],
        ["delivery_booking_id", 160],
        ["rider_name", 120],
        ["rider_phone", 20],
      ];
      for (const [field, maxLength] of textFields) {
        if (body[field] !== undefined) {
          update[field] = cleanText(body[field], maxLength);
        }
      }

      if (body.tracking_url !== undefined) {
        const trackingUrl = cleanText(body.tracking_url, 500);
        if (!trackingUrl) {
          update.tracking_url = null;
        } else {
          try {
            const url = new URL(trackingUrl);
            if (url.protocol !== "https:") {
              return jsonResponse({ success: false, message: "Tracking URL must use HTTPS." }, 400);
            }
            update.tracking_url = url.toString();
          } catch {
            return jsonResponse({ success: false, message: "Invalid tracking URL." }, 400);
          }
        }
      }

      if (body.delivery_partner_cost !== undefined) {
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
        .select(orderSelect(type))
        .maybeSingle();

      if (updateError) {
        /* Failure is logged by the response helper without customer or error payloads. */
        return jsonResponse({ success: false, message: "Could not save delivery details." }, 500);
      }
      if (!updated) {
        return jsonResponse({ success: false, message: "Order not found." }, 404);
      }
      return jsonResponse({ success: true, order: updated });
    }

    if (action === "update_status") {
      const type = body.order_type;
      const orderId = cleanOrderId(body.order_id);
      const nextStatus = body.status;
      const reason = cleanText(body.reason, 500) ?? "";

      if (!isOrderType(type) || !orderId || !isOrderStatus(nextStatus)) {
        return jsonResponse({ success: false, message: "Invalid status update." }, 400);
      }
      if ((nextStatus === "rejected" || nextStatus === "cancelled") && reason.length < 3) {
        return jsonResponse({ success: false, message: "Please record a reason." }, 400);
      }

      const names = tableNames(type);
      const { data: current, error: currentError } = await admin
        .from(names.orders)
        .select(orderSelect(type))
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
        .eq("order_status", currentStatus)
        .select(orderSelect(type))
        .maybeSingle();

      if (updateError) {
        /* Failure is logged by the response helper without customer or error payloads. */
        return jsonResponse({ success: false, message: "Could not update order status." }, 500);
      }
      if (!updated) {
        return jsonResponse({ success: false, message: "Order changed. Refresh and try again." }, 409);
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
        /* Failure is logged by the response helper without customer or error payloads. */
      }

      return jsonResponse({ success: true, order: updated });
    }

    return jsonResponse({ success: false, message: "Unsupported action." }, 400);
  } catch (err) {
    /* Failure is logged by the response helper without customer or error payloads. */
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

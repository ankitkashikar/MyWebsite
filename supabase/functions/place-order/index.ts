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

// Technical currency bound compatible with numeric(10,2), not a business
// minimum/maximum order policy. All arithmetic below is in integer paise.
const MAX_MONEY_PAISE = 9_999_999_999;

function priceToPaise(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  // Parse decimal digits instead of multiplying floating-point rupees by 100.
  // Reject fractional paise rather than silently rounding catalogue errors.
  const text = String(value);
  if (!/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?$/.test(text)) return null;
  const [rupees, fraction = ""] = text.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 && paise <= MAX_MONEY_PAISE
    ? paise
    : null;
}

// Offset-less browser values are India wall time, never server/device local time.
function bulkDeliveryInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(Z|\+05:30)?$/.exec(value);
  if (!m || +m[2] > 23 || +m[3] > 59 || +(m[4] || 0) > 59) return null;
  const wall = `${m[1]}T${m[2]}:${m[3]}:${m[4] || "00"}.${m[5] || "000"}`;
  const check = new Date(wall + "Z");
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== m[1]) return null;
  return check.getTime() - (m[6] === "Z" ? 0 : 330 * 60000);
}
function validBulkSchedule(value: unknown, now = new Date()): boolean {
  const instant = bulkDeliveryInstant(value);
  return instant !== null && instant - now.getTime() >= 24 * 60 * 60 * 1000;
}

// Normal checkout accepts only dated half-hour slots in India's delivery window.
// Keep this after saved-request lookup at the call site so retries remain stable.
function validNormalSchedule(slot: string, now = new Date()): boolean {
  const indiaNow = new Date(now.getTime() + 330 * 60000);
  if (slot === "ASAP (35–50 min)") return indiaNow.getUTCHours() >= 16;
  const match = /^(\d{1,2}):(00|30)\s*(am|pm) – (\d{1,2}):(00|30)\s*(am|pm) \((\d{4}-\d{2}-\d{2})\)$/.exec(slot);
  if (!match) return false;
  const minutes = (hour: string, minute: string, period: string) => {
    const h = Number(hour);
    return h >= 1 && h <= 12 ? (h % 12 + (period === "pm" ? 12 : 0)) * 60 + Number(minute) : -1;
  };
  const start = minutes(match[1], match[2], match[3]);
  const end = minutes(match[4], match[5], match[6]);
  if (start < 960 || start > 1410 || end !== (start + 30) % 1440) return false;
  const midnight = Date.parse(match[7] + "T00:00:00+05:30");
  if (!Number.isFinite(midnight) || new Date(midnight + 330 * 60000).toISOString().slice(0, 10) !== match[7]) return false;
  const today = indiaNow.toISOString().slice(0, 10);
  const tomorrow = new Date(indiaNow.getTime() + 86400000).toISOString().slice(0, 10);
  if (match[7] !== today && match[7] !== tomorrow) return false;
  return midnight + start * 60000 >= now.getTime();
}

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
    /* Failure is logged by the response helper without customer or error payloads. */
    return false;
  }
  return data === true;
}

Deno.serve(async (req) => {
  // Generated per request; never accept a caller-supplied support reference.
  const reference = crypto.randomUUID();
  const started = Date.now();
  function jsonResponse(body: unknown, status = 200) {
    if (status >= 400) {
      console.warn(JSON.stringify({event: "api_failure", endpoint: "place-order", reference,
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

    if (coupon_code != null && typeof coupon_code !== "string") {
      return jsonResponse({ success: false, message: "Coupon is not available for this order." }, 400);
    }
    const cleanCoupon = (coupon_code ?? "").trim().toUpperCase();
    if (cleanCoupon && !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(cleanCoupon)) {
      return jsonResponse({ success: false, message: "Coupon is not available for this order." }, 400);
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

    // Canonical payload binds the key to every meaningful customer/order field.
    // Consolidation makes equivalent cart ordering/duplicate lines retry-safe.
    const canonicalQty = new Map<string, number>();
    for (const item of normalizedItems) canonicalQty.set(item.id, (canonicalQty.get(item.id) ?? 0) + item.qty);
    const canonicalItems = [...canonicalQty].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([id, qty]) => ({ id, qty }));
    const canonicalRequest = {
      type, name: cleanName, phone: cleanPhone, address: cleanAddress,
      notes: cleanNotes || null, coupon_code: cleanCoupon || null, payment_method: "upi",
      items: canonicalItems,
      ...(body.action === "quote" || body.delivery_version === undefined ? {} : {delivery_version:body.delivery_version, expected_total_paise:body.expected_total_paise ?? null}),
      ...(type === "normal" ? {pincode: DIRECT_DELIVERY_PIN, delivery_slot: delivery_slot.trim()}
        : {event_type: event_type ? String(event_type).trim().slice(0, 120) : null, delivery_datetime}),
    };
    if (body.action !== "quote") {
    const {data: existing, error: existingError} = await admin.rpc("lookup_order_request", {
      p_key: idempotency_key, p_request: canonicalRequest,
    });
    if (existingError) {
      return jsonResponse({success: false, message: existingError.code === "P0002"
        ? "This checkout request has changed. Start a new checkout."
        : "Could not validate this order. Please try again."}, existingError.code === "P0002" ? 409 : 500);
    }
    if (existing) return jsonResponse(existing);
    }

    if (type === "normal" && !validNormalSchedule(delivery_slot.trim())) {
      return jsonResponse({success: false, message:
        "This delivery slot is unavailable. Choose a new slot in India time (4 PM–12 AM)."}, 400);
    }

    if (type === "bulk" && !validBulkSchedule(delivery_datetime)) {
      return jsonResponse({success: false, message:
        "Bulk orders require at least 24 hours notice. Choose a later delivery date and time in India time."}, 400);
    }

    const { error: menuError } = await admin.rpc("validate_menu_cart", {
      p_type: type, p_items: canonicalItems,
    });
    if (menuError) {
      return jsonResponse({success:false, message:menuError.code === "P0001"
        ? "Your menu selections are unavailable. Check the selected dish, variant and add-ons."
        : "Could not validate the menu. Please try again."}, menuError.code === "P0001" ? 400 : 503);
    }

    // Server-trusted product lookup and pricing.
    const productIds = [...new Set(normalizedItems.map((item) => item.id))];
    const { data: products, error: productErr } = await admin
      .from("products")
      .select("id, name, price, active, order_type")
      .in("id", productIds)
      .eq("order_type", type);

    if (productErr) {
      /* Failure is logged by the response helper without customer or error payloads. */
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
    let subtotalPaise = 0;

    // Consolidate duplicate product IDs before totals are calculated.
    const qtyById = new Map<string, number>();
    for (const item of canonicalItems) {
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

      const unitPricePaise = priceToPaise(product.price);
      if (unitPricePaise === null) {
        /* Failure is logged by the response helper without customer or error payloads. */
        return jsonResponse({ success: false, message: "Could not price this order." }, 500);
      }

      const lineTotalPaise = unitPricePaise * qty;
      const nextSubtotalPaise = subtotalPaise + lineTotalPaise;
      if (
        !Number.isSafeInteger(lineTotalPaise) || lineTotalPaise <= 0 ||
        lineTotalPaise > MAX_MONEY_PAISE ||
        !Number.isSafeInteger(nextSubtotalPaise) || nextSubtotalPaise > MAX_MONEY_PAISE
      ) {
        return jsonResponse({ success: false, message: "Could not price this order." }, 500);
      }
      subtotalPaise = nextSubtotalPaise;
      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPricePaise / 100,
        quantity: qty,
        line_total: lineTotalPaise / 100,
      });
    }

    // Independently revalidate on every new order. The database trigger checks
    // again while holding the coupon lock when the order is inserted.
    let discountPaise = 0;
    if (cleanCoupon) {
      const { data: quote, error: couponError } = await admin.rpc("quote_coupon", {
        p_code: cleanCoupon, p_type: type, p_phone: cleanPhone, p_items: normalizedItems,
      });
      if (couponError || !quote || quote.subtotal_paise !== subtotalPaise ||
          !Number.isSafeInteger(quote.discount_paise) || quote.discount_paise <= 0 ||
          quote.discount_paise >= subtotalPaise ||
          quote.total_paise !== subtotalPaise - quote.discount_paise) {
        return jsonResponse({ success: false, message: "Coupon is not available for this order." }, 400);
      }
      discountPaise = quote.discount_paise;
    }
    const {data: delivery, error: deliveryError} = await admin.rpc("quote_delivery_fee",{p_type:type,p_net:subtotalPaise-discountPaise});
    if (deliveryError || !delivery || !Number.isSafeInteger(delivery.fee_paise)) {
      return jsonResponse({success:false,message:"Delivery is currently unavailable for this order type. Please contact the kitchen."},503);
    }
    const deliveryFeePaise = delivery.fee_paise;
    const totalPaise = subtotalPaise - discountPaise + deliveryFeePaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || totalPaise > MAX_MONEY_PAISE) {
      return jsonResponse({ success: false, message: "Could not price this order." }, 500);
    }
    // Preserve the existing database/API rupee contract at the write boundary.
    const subtotal = subtotalPaise / 100;
    const discount = discountPaise / 100;
    const deliveryFee = deliveryFeePaise / 100;
    const total = totalPaise / 100;

    if (body.action === "quote") return jsonResponse({success:true,subtotal,discount,delivery_fee:deliveryFee,total,delivery_version:delivery.version,total_paise:totalPaise});
    if (body.delivery_version !== delivery.version || body.expected_total_paise !== totalPaise) {
      return jsonResponse({success:false,message:"Delivery or prices changed. Return to checkout and review the new total."},409);
    }
    const orderRow: Record<string, unknown> = {
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
    if (cleanCoupon) orderRow.coupon_items = normalizedItems;

    if (type === "bulk") {
      orderRow.event_type = event_type ? String(event_type).trim().slice(0, 120) : null;
      orderRow.delivery_datetime = new Date(bulkDeliveryInstant(delivery_datetime)!).toISOString();
    } else {
      orderRow.pincode = DIRECT_DELIVERY_PIN;
      orderRow.delivery_slot = delivery_slot.trim();
    }

    // One database transaction owns the key, customer, header and all items.
    const {data: order, error: orderErr} = await admin.rpc("create_order_atomic", {
      p_key: idempotency_key, p_request: canonicalRequest, p_order: orderRow, p_items: lineItems,
    });
    if (orderErr || !order) {
      const status = orderErr?.code === "P0002" ? 409 : orderErr?.code === "P0001" ? 400 : 500;
      const message = status === 409 ? "This checkout request has changed. Start a new checkout."
        : status === 400 ? "Order details or pricing changed. Please review your checkout."
        : "Could not save your order. Please try again.";
      return jsonResponse({success: false, message}, status);
    }
    return jsonResponse(order);

  } catch (err) {
    /* Failure is logged by the response helper without customer or error payloads. */
    return jsonResponse({ success: false, message: "Something went wrong. Please try again." }, 500);
  }
});

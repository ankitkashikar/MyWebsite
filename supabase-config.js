/* ============================================================
   Supabase config — The Chinese Bliss
   ------------------------------------------------------------
   SUPABASE_ANON_KEY below is the PUBLIC "anon" key. It is safe
   to have this visible in the browser / GitHub repo — that's
   how Supabase's anon key is designed to be used. It cannot
   read or write protected restaurant data on its own because
   access is controlled server-side / with Row Level Security.

   The SERVICE ROLE key is never in this file, never in this
   repo, and never sent to the browser. It lives only inside
   Supabase Edge Functions.
   ============================================================ */

const SUPABASE_URL = "https://ncbyfovvetvmkrlzapku.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYnlmb3Z2ZXR2bWtybHphcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzk4NTksImV4cCI6MjEwMjQ1NTg1OX0.fBmK-SzdkJDRPmCpFNWRVZn113W27UF9OscDCe6T0bM";

const PLACE_ORDER_URL = `${SUPABASE_URL}/functions/v1/place-order`;
const ADMIN_ORDERS_URL = `${SUPABASE_URL}/functions/v1/admin-orders`;
const ORDER_STATUS_URL = `${SUPABASE_URL}/functions/v1/order-status`;

// Public browser configuration used by authenticated internal pages and
// customer order tracking. Only the anon key is exposed here; privileged
// keys remain server-side.
window.TCB_SUPABASE_CONFIG = Object.freeze({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  placeOrderUrl: PLACE_ORDER_URL,
  adminOrdersUrl: ADMIN_ORDERS_URL,
  orderStatusUrl: ORDER_STATUS_URL,
});

/**
 * Sends an order to the place-order Edge Function.
 * Only ever sends product ids + quantities — never a price or total.
 * The server recalculates everything from the real product prices.
 *
 * @param {Object} payload
 * @returns {Promise<{success: boolean, order_number?: string, total?: number, message?: string}>}
 */
async function submitOrder(payload) {
  try {
    const res = await fetch(PLACE_ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !data.success) {
      return { success: false, httpStatus: res.status, message: tcbFailureMessage(data, res.status, "Order could not be confirmed. Keep this checkout open and retry with the same details.") };
    }
    return data;
  } catch (err) {
    return { success: false, message: payload.action === "quote" ? "Delivery charges could not be checked. Check your connection and retry." : "We could not confirm whether your order was received. Keep this checkout open and retry without changing its details. Do not make another payment." };
  }
}

/**
 * Looks up one customer's direct website order by order number + phone.
 * The server returns only customer-safe tracking fields.
 */
async function lookupTCBOrderStatus(orderNumber, phone) {
  try {
    const res = await fetch(ORDER_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ order_number: orderNumber, phone }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success) {
      return { success: false, httpStatus: res.status, message: tcbFailureMessage(data, res.status, "Order status is temporarily unavailable. Please try again later.") };
    }
    return data;
  } catch (err) {
    return { success: false, message: "Order status could not be refreshed. Check your connection and try again." };
  }
}

window.lookupTCBOrderStatus = lookupTCBOrderStatus;

/** Generates a cryptographically strong RFC 4122 v4 idempotency key. */
function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random values are unavailable in this browser.");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** Informational coupon quote; final orders always revalidate server-side. */
async function validateTCBCoupon(payload) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-coupon`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result || result.valid !== true) {
      return {valid: false, message: tcbFailureMessage(result, response.status, "Coupon service is temporarily unavailable. Please try again later.")};
    }
    return result;
  } catch {
    return {valid: false, message: "Coupon could not be checked. Please try again."};
  }
}
window.validateTCBCoupon = validateTCBCoupon;

// Do not display raw proxy/server failure text. Only carry a validated support ID.
function tcbFailureMessage(data, status, fallback) {
  const reference = typeof data?.reference === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.reference)
    ? ' Reference: ' + data.reference : '';
  if (status === 429) return 'Too many attempts. Please wait 10 minutes before trying again.' + reference;
  if (status >= 500 || status === 401 || status === 403) return fallback + reference;
  return typeof data?.message === 'string' ? data.message : fallback + reference;
}

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
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !data.success) {
      return { success: false, message: (data && data.message) || "Could not place your order. Please try again." };
    }
    return data;
  } catch (err) {
    console.error("submitOrder network error", err);
    return { success: false, message: "Network error — please check your connection and try again." };
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
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success) {
      return { success: false, message: (data && data.message) || "Could not load your order status. Please try again." };
    }
    return data;
  } catch (err) {
    console.error("lookupTCBOrderStatus network error", err);
    return { success: false, message: "Network error — please check your connection and try again." };
  }
}

window.lookupTCBOrderStatus = lookupTCBOrderStatus;

/** Generates a fresh idempotency key for one checkout attempt. */
function newIdempotencyKey() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

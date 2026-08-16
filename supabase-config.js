/* ============================================================
   Supabase config — The Chinese Bliss
   ------------------------------------------------------------
   SUPABASE_ANON_KEY below is the PUBLIC "anon" key. It is safe
   to have this visible in the browser / GitHub repo — that's
   how Supabase's anon key is designed to be used. It cannot
   read or write anything on its own because Row Level Security
   is enabled with no policies (see supabase_migration.sql).

   The SERVICE ROLE key is never in this file, never in this
   repo, and never sent to the browser — it lives only inside
   the place-order Edge Function on Supabase's servers.
   ============================================================ */

const SUPABASE_URL = "https://ncbyfovvetvmkrlzapku.supabase.co"; // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYnlmb3Z2ZXR2bWtybHphcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzk4NTksImV4cCI6MjEwMjQ1NTg1OX0.fBmK-SzdkJDRPmCpFNWRVZn113W27UF9OscDCe6T0bM";

const PLACE_ORDER_URL = `${SUPABASE_URL}/functions/v1/place-order`;

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

/** Generates a fresh idempotency key for one checkout attempt. */
function newIdempotencyKey() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

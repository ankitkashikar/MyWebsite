import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "https://ankitkashikar.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json",
};
const unavailable = "Coupon is not available for this order.";
const baseResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});

Deno.serve(async (req) => {
  // Generated per request; never accept a caller-supplied support reference.
  const reference = crypto.randomUUID();
  const started = Date.now();
  function reply(body: unknown, status = 200) {
    if (status >= 400) {
      console.warn(JSON.stringify({event: "api_failure", endpoint: "validate-coupon", reference,
        status, duration_ms: Date.now() - started}));
      if (body && typeof body === "object") {
        const result = body as Record<string, unknown>;
        body = {...result, reference,
          message: String(result.message || "Request could not be completed.") + " Reference: " + reference};
      }
    }
    return baseResponse(body, status);
  }

  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "POST") return reply({valid: false, message: "Method not allowed."}, 405);
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return reply({valid: false, message: "Content-Type must be application/json."}, 415);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({valid: false, message: unavailable}, 503);
  try {
    const admin = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 80);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`validate-coupon:${ip}`));
    const rateKey = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
    const rate = await admin.rpc("consume_security_rate_limit", {p_key: rateKey, p_limit: 30, p_window_seconds: 600});
    if (rate.error) return reply({valid: false, message: "Coupon service is temporarily unavailable."}, 503);
    if (rate.data !== true) return reply({valid: false, message: "Please wait before trying another coupon."}, 429);
    // Bound actual streamed bytes, including requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return reply({valid: false, message: unavailable}, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return reply({valid: false, message: "Request is too large."}, 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return reply({valid: false, message: unavailable}, 400); }
    if (!body || typeof body.code !== "string" || typeof body.phone !== "string" ||
        !["normal", "bulk"].includes(body.type) || !Array.isArray(body.items)) {
      return reply({valid: false, message: unavailable}, 400);
    }
    const code = body.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) return reply({valid: false, message: unavailable}, 400);
    const {data, error} = await admin.rpc("quote_coupon", {
      p_code: code, p_type: body.type, p_phone: body.phone.trim(), p_items: body.items,
    });
    if (error || !data || !Number.isSafeInteger(data.discount_paise) || data.discount_paise <= 0 ||
        !Number.isSafeInteger(data.subtotal_paise) || data.subtotal_paise > 9999999999 ||
        data.total_paise !== data.subtotal_paise - data.discount_paise || data.total_paise <= 0) {
      return reply({valid: false, message: unavailable}, error && error.code !== "P0001" ? 503 : 400);
    }
    return reply({valid: true, code, discount: data.discount_paise / 100,
      subtotal: data.subtotal_paise / 100, total: data.total_paise / 100,
      label: `₹${(data.discount_paise / 100).toFixed(2)} off`});
  } catch {
    return reply({valid: false, message: unavailable}, 503);
  }
});

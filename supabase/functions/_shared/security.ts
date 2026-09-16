// Shared security helpers for The Chinese Bliss website Edge Functions.
// Keep this file server-side only. It contains no browser secrets.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://ankitkashikar.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("TCB_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true; // non-browser/server-to-server requests have no Origin
  return allowedOrigins().has(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...extraHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function preflightResponse(req: Request): Response {
  return new Response("ok", { status: 204, headers: corsHeaders(req) });
}

export function rejectDisallowedOrigin(req: Request): Response | null {
  if (isAllowedOrigin(req)) return null;
  return jsonResponse(req, { success: false, message: "Request origin is not allowed." }, 403);
}

export async function readJsonBody(req: Request, maxBytes = 32_768): Promise<
  | { ok: true; value: any }
  | { ok: false; response: Response }
> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return { ok: false, response: jsonResponse(req, { success: false, message: "Content-Type must be application/json." }, 415) };
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: jsonResponse(req, { success: false, message: "Request is too large." }, 413) };
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, response: jsonResponse(req, { success: false, message: "Request is too large." }, 413) };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : {} };
  } catch {
    return { ok: false, response: jsonResponse(req, { success: false, message: "Invalid JSON request." }, 400) };
  }
}

function clientAddress(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function rateLimit(
  admin: any,
  req: Request,
  route: string,
  limit: number,
  windowSeconds: number,
  subject = "",
): Promise<{ allowed: boolean; remaining: number; resetAt?: string }> {
  const salt = Deno.env.get("TCB_RATE_LIMIT_SALT") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "tcb";
  const ua = (req.headers.get("user-agent") ?? "unknown").slice(0, 180);
  const address = clientAddress(req);
  const fingerprint = await sha256Hex(`${salt}|${address}|${ua}|${subject}`);
  const bucket = `${route}:${fingerprint}`.slice(0, 220);

  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error || !Array.isArray(data) || !data[0]) {
    console.error("rate limiter failed", route, error);
    throw new Error("rate_limit_unavailable");
  }

  return {
    allowed: Boolean(data[0].allowed),
    remaining: Number(data[0].remaining ?? 0),
    resetAt: data[0].reset_at ? String(data[0].reset_at) : undefined,
  };
}

export function rateLimitResponse(req: Request, resetAt?: string): Response {
  const headers: Record<string, string> = {};
  if (resetAt) {
    const seconds = Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000));
    if (Number.isFinite(seconds)) headers["Retry-After"] = String(seconds);
  }
  return jsonResponse(req, { success: false, message: "Too many requests. Please wait and try again." }, 429, headers);
}

export function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function safeHttpUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

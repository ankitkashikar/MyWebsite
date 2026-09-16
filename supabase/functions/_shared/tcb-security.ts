import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = ["https://ankitkashikar.github.io"];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("TCB_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return allowedOrigins().has(origin);
}

export function responseHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(req),
  });
}

export function preflightResponse(req: Request): Response {
  if (!isAllowedOrigin(req)) {
    return jsonResponse(req, { success: false, message: "Origin not allowed." }, 403);
  }
  return new Response(null, { status: 204, headers: responseHeaders(req) });
}

export async function readJsonBody(req: Request, maxBytes = 24_000): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestError(415, "Content-Type must be application/json.");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestError(413, "Request body is too large.");
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new RequestError(413, "Request body is too large.");
  }
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("invalid shape");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new RequestError(400, "Invalid JSON request.");
  }
}

export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function rateLimitKey(scope: string, value: string): Promise<string> {
  const salt = Deno.env.get("TCB_RATE_LIMIT_SALT") ?? "tcb-rate-limit-v1";
  return sha256Hex(`${salt}:${scope}:${value}`);
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  scope: string,
  keyHash: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await admin.rpc("tcb_consume_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error);
    throw new RequestError(503, "Service temporarily unavailable.");
  }
  if (data !== true) {
    throw new RequestError(429, "Too many requests. Please wait and try again.");
  }
}

export function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function validHttpUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

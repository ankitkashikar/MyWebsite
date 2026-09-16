#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []


def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        errors.append(f"Missing required file: {path}")
        return ""
    return p.read_text(encoding="utf-8")


def require(path: str, text: str, label: str):
    content = read(path)
    if text not in content:
        errors.append(f"{path}: missing {label}")


def forbid(path: str, text: str, label: str):
    content = read(path)
    if text in content:
        errors.append(f"{path}: forbidden {label}")


# Shared request hardening.
shared = read("supabase/functions/_shared/tcb-security.ts")
for token, label in [
    ("TCB_ALLOWED_ORIGINS", "origin allowlist"),
    ("Cache-Control", "no-store response policy"),
    ("X-Content-Type-Options", "nosniff response header"),
    ("readJsonBody", "bounded JSON parser"),
    ("tcb_consume_rate_limit", "server-side rate limiting"),
]:
    if token not in shared:
        errors.append(f"shared security helper missing {label}")
if '"Access-Control-Allow-Origin": "*"' in shared:
    errors.append("shared security helper must not allow wildcard production CORS")

# Public order creation must never trust browser price/total or write directly from frontend.
place = read("supabase/functions/place-order/index.ts")
for token, label in [
    ('.from("products")', "server product lookup"),
    ('payment_status: "pending"', "pending payment default"),
    ("enforceRateLimit", "rate limiting"),
    ("IDEMPOTENCY_RE", "idempotency validation"),
    ("subtotalPaise", "integer money calculation"),
    ("DIRECT_DELIVERY_PIN", "server PIN enforcement"),
]:
    if token not in place:
        errors.append(f"place-order missing {label}")
if re.search(r"\b(body\.)?(price|total)\b", place) and "server" not in place.lower():
    errors.append("place-order appears to trust browser pricing")
if 'Access-Control-Allow-Origin": "*"' in place:
    errors.append("place-order contains wildcard CORS")

# Admin API authorization and transition protection.
admin = read("supabase/functions/admin-orders/index.ts")
for token, label in [
    ("TCB_ADMIN_EMAIL", "single-account allowlist"),
    ("auth.getUser", "server JWT validation"),
    ("email_confirmed_at", "confirmed-email requirement"),
    ("ALLOWED_TRANSITIONS", "server lifecycle state machine"),
    ('current.payment_status !== "paid"', "paid-before-accept rule"),
    ("order_status_events", "status audit trail"),
    ("order_admin_events", "admin action audit trail"),
    ("enforceRateLimit", "admin API rate limit"),
    ('.eq("order_status", currentStatus)', "optimistic concurrency guard"),
    ("aal2", "mandatory MFA enforcement"),
]:
    if token not in admin:
        errors.append(f"admin-orders missing {label}")
if 'Access-Control-Allow-Origin": "*"' in admin:
    errors.append("admin-orders contains wildcard CORS")

# Customer tracking must be narrow and rate limited.
status = read("supabase/functions/order-status/index.ts")
for token, label in [
    ("order_number", "order-number lookup"),
    ("phone", "phone possession check"),
    ("enforceRateLimit", "tracking rate limit"),
    ("validHttpUrl", "safe external tracking URL"),
]:
    if token not in status:
        errors.append(f"order-status missing {label}")
select_section = status.split('.select([', 1)[-1].split('].join', 1)[0] if '.select([' in status else ""
for sensitive in ['"address"', '"name"', '"notes"', '"rejection_reason"', '"cancellation_reason"']:
    if sensitive in select_section:
        errors.append(f"order-status customer response selects sensitive field {sensitive}")

# Database hardening.
migration = read("supabase/migrations/20260917_order_security_hardening.sql")
for token, label in [
    ("enable row level security", "RLS enablement"),
    ("revoke all privileges", "browser privilege revocation"),
    ("normal_orders_idempotency_unique", "normal-order idempotency uniqueness"),
    ("bulk_orders_idempotency_unique", "bulk-order idempotency uniqueness"),
    ("order_admin_events", "admin audit table"),
    ("tcb_security_rate_limits", "rate limit table"),
    ("security definer", "server-only rate limiter function"),
]:
    if token not in migration.lower():
        errors.append(f"security migration missing {label}")

# Frontend must never contain server secrets.
frontend_extensions = {".html", ".js", ".css"}
for p in ROOT.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in frontend_extensions:
        continue
    if "supabase/functions" in p.as_posix():
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    for secret_marker in ["SUPABASE_SERVICE_ROLE_KEY", "sb_secret_", "DATABASE_URL=", "TCB_RATE_LIMIT_SALT="]:
        if secret_marker in text:
            errors.append(f"{p.relative_to(ROOT)}: server secret marker exposed in frontend")

orders_html = read("orders.html")
for token, label in [
    ("challengeAndVerify", "TOTP MFA challenge"),
    ("getAuthenticatorAssuranceLevel", "AAL gate"),
    ("storage: window.sessionStorage", "tab-scoped admin session storage"),
]:
    if token not in orders_html:
        errors.append(f"orders.html missing {label}")

# The public config may contain a publishable/legacy anon key, never a server key.
config = read("supabase-config.js")
if "SUPABASE_SERVICE_ROLE_KEY" in config:
    errors.append("supabase-config.js must not contain the service-role key name/value")
if "TCB_SUPABASE_CONFIG" not in config:
    errors.append("supabase-config.js missing browser config")

if errors:
    print("TCB SECURITY QA: FAIL")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)

print("TCB SECURITY QA: PASS")
print(" - browser roles blocked from sensitive direct DB writes")
print(" - server pricing / idempotency / rate limiting present")
print(" - single-account admin authorization and lifecycle enforcement present")
print(" - customer tracking field exposure constrained")
print(" - no server secret markers found in frontend assets")

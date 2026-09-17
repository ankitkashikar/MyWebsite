#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []


def require(text: str, token: str, message: str) -> None:
    if token not in text:
        ERRORS.append(message)


place_path = ROOT / "supabase/functions/place-order/index.ts"
config_path = ROOT / "supabase-config.js"
migration_path = ROOT / "supabase/migrations/20260917_security_hardening.sql"

for path in (place_path, config_path, migration_path):
    if not path.exists():
        ERRORS.append(f"Missing Step 1A file: {path.relative_to(ROOT)}")

if ERRORS:
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

place = place_path.read_text(encoding="utf-8")
config = config_path.read_text(encoding="utf-8")
migration = migration_path.read_text(encoding="utf-8")

# Public order endpoint must not use wildcard browser access.
if 'Access-Control-Allow-Origin\": \"*\"' in place:
    ERRORS.append("place-order still uses wildcard CORS")
require(place, 'const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";', "place-order production origin is not locked")
require(place, '"Cache-Control": "no-store"', "place-order responses must be non-cacheable")
require(place, '"X-Content-Type-Options": "nosniff"', "place-order is missing nosniff response protection")
require(place, 'includes("application/json")', "place-order must reject unsupported content types")
require(place, "MAX_BODY_BYTES", "place-order must limit request size")

# Abuse and replay controls.
require(place, "UUID_RE", "place-order must validate idempotency keys as UUIDs")
require(place, "consume_security_rate_limit", "place-order rate limiting is missing")
require(place, "12, 600", "place-order rate-limit policy changed unexpectedly")
require(place, "items.length > 60", "place-order cart line-count cap is missing")
require(place, "totalQty > maxTotalQty", "place-order aggregate quantity cap is missing")

# Server remains authoritative for payment, delivery PIN and pricing.
require(place, 'payment_method !== "upi"', "place-order must reject unsupported payment methods")
require(place, 'const DIRECT_DELIVERY_PIN = "411057";', "place-order delivery PIN enforcement is missing")
require(place, '.from("products")', "place-order must load product data server-side")
require(place, '.select("id, name, price, active, order_type")', "place-order server pricing lookup changed unexpectedly")
require(place, 'payment_status: "pending"', "customer self-report must not mark payment as paid")

# A failed item insert must not leave a successful-looking order header behind.
require(place, '.delete().eq("id", order.id)', "place-order orphan-order cleanup is missing")

# Service-role material must only be read from the Edge Function environment.
require(place, 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', "place-order service-role key must come from the server environment")
if re.search(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]", place):
    ERRORS.append("place-order appears to contain a hard-coded service-role key")

# Browser idempotency fallback must still produce an RFC 4122 v4 UUID.
require(config, "crypto.randomUUID", "browser idempotency generator should prefer crypto.randomUUID")
require(config, "crypto.getRandomValues", "browser idempotency generator needs a secure UUID fallback")
if "Date.now()}-${Math.random" in config or "Math.random().toString" in config:
    ERRORS.append("browser idempotency generator still has a non-UUID Math.random fallback")

# Database support is staged but intentionally not applied in Step 1A.
lower_migration = migration.lower()
for token, message in [
    ("create table if not exists public.security_rate_limits", "rate-limit table migration is missing"),
    ("enable row level security", "rate-limit/operational RLS hardening is missing"),
    ("consume_security_rate_limit", "rate-limit RPC migration is missing"),
    ("security invoker", "rate-limit RPC must run with caller/service-role privileges"),
    ("set search_path = ''", "rate-limit RPC must use a locked search_path"),
    ("revoke all on function public.consume_security_rate_limit", "rate-limit RPC must revoke public execution"),
    ("grant execute on function public.consume_security_rate_limit", "rate-limit RPC must grant only intended server execution"),
    ("grant select, insert, update on table public.security_rate_limits to service_role", "service_role table privileges for rate limiting are missing"),
    ("to service_role", "rate-limit RPC must be executable by service_role"),
    ("drop constraint if exists normal_orders_payment_status_check", "normal payment-status constraint must replace the live legacy constraint"),
    ("drop constraint if exists bulk_orders_payment_status_check", "bulk payment-status constraint must replace the live legacy constraint"),
    ("generate_normal_order_number() set search_path", "normal order helper search_path hardening is missing"),
    ("generate_bulk_order_number() set search_path", "bulk order helper search_path hardening is missing"),
    ("touch_updated_at() set search_path", "updated_at helper search_path hardening is missing"),
]:
    if token not in lower_migration:
        ERRORS.append(message)

if ERRORS:
    print("TCB STEP 1A SECURITY QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 1A SECURITY QA PASS")

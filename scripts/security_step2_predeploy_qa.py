#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []

paths = {
    "admin": ROOT / "supabase/functions/admin-orders/index.ts",
    "status": ROOT / "supabase/functions/order-status/index.ts",
    "browser": ROOT / "supabase-config.js",
    "console": ROOT / "orders.html",
    "config": ROOT / "supabase/config.toml",
}

for label, path in paths.items():
    if not path.exists():
        ERRORS.append(f"Missing Step 2 predeploy file ({label}): {path.relative_to(ROOT)}")

if ERRORS:
    print("TCB STEP 2 PREDEPLOY QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

admin = paths["admin"].read_text(encoding="utf-8")
status = paths["status"].read_text(encoding="utf-8")
browser = paths["browser"].read_text(encoding="utf-8")
console = paths["console"].read_text(encoding="utf-8")
config = paths["config"].read_text(encoding="utf-8")


def require(text: str, token: str, message: str) -> None:
    if token not in text:
        ERRORS.append(message)


# Browser must target the website Supabase project only.
require(browser, "https://ncbyfovvetvmkrlzapku.supabase.co", "browser Supabase URL is not the website project")
if "friglfticlkpgcsothel" in browser + admin + status + config:
    ERRORS.append("TCB_Dashboard project ref appears in website Step 2 security files")
if "SUPABASE_SERVICE_ROLE_KEY" in browser:
    ERRORS.append("service-role key identifier must not appear in browser config")

# Admin browser invocation must pass a signed-in user JWT plus the public API key.
require(console, "client.auth.getSession()", "order console does not obtain the current authenticated session")
require(console, "fetch(config.adminOrdersUrl", "order console does not call admin-orders")
require(console, "'Authorization': `Bearer ${token}`", "order console does not send the signed-in user JWT")
require(console, "'apikey': config.anonKey", "order console does not send the public API key")

# Customer tracking caller remains compatible with the public custom-auth function.
require(browser, "fetch(ORDER_STATUS_URL", "browser does not call order-status")
require(browser, "body: JSON.stringify({ order_number: orderNumber, phone })", "order-status browser payload changed unexpectedly")
require(browser, '"apikey": SUPABASE_ANON_KEY', "order-status request must include the project API key")

# Pin Edge Function auth behavior explicitly. Admin requires a user JWT;
# customer status lookup uses its own possession-based auth + throttling.
for pattern, message in [
    (r"\[functions\.place-order\]\s*verify_jwt\s*=\s*true", "place-order verify_jwt must remain enabled"),
    (r"\[functions\.admin-orders\]\s*verify_jwt\s*=\s*true", "admin-orders verify_jwt must be enabled"),
    (r"\[functions\.order-status\][\s\S]*?verify_jwt\s*=\s*false", "order-status verify_jwt must be disabled for public customer lookup"),
]:
    if not re.search(pattern, config, re.MULTILINE):
        ERRORS.append(message)

# Both Step 2 functions must keep the production browser boundary and rate-limit RPC.
for name, text in [("admin-orders", admin), ("order-status", status)]:
    require(text, 'const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";', f"{name} production origin is not locked")
    if '"Access-Control-Allow-Origin": "*"' in text:
        ERRORS.append(f"{name} still uses wildcard CORS")
    require(text, '"Cache-Control": "no-store"', f"{name} responses must be non-cacheable")
    require(text, "consume_security_rate_limit", f"{name} is missing database-backed rate limiting")
    require(text, 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', f"{name} must obtain service-role credentials server-side")

# Admin defense-in-depth: platform JWT plus handler-level user/email validation.
require(admin, 'Deno.env.get("TCB_ADMIN_EMAIL")', "admin-orders does not require TCB_ADMIN_EMAIL")
require(admin, "auth.getUser(token)", "admin-orders does not revalidate the user JWT")
require(admin, "email !== adminEmail", "admin-orders does not enforce the configured operations email")

# Customer lookup must require both factors and avoid broad data selection.
require(status, '.eq("order_number", orderNumber)', "order-status does not require exact order number")
require(status, '.eq("phone", phone)', "order-status does not require exact phone")
if '.select("*")' in status:
    ERRORS.append("order-status must not select full order rows")
require(status, "30, 600", "order-status per-IP throttle changed unexpectedly")
require(status, "8, 600", "order-status per-order throttle changed unexpectedly")

if ERRORS:
    print("TCB STEP 2 PREDEPLOY QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 2 PREDEPLOY QA PASS")

#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "supabase/functions/admin-orders/index.ts"
ERRORS: list[str] = []

if not PATH.exists():
    print("TCB STEP 2 ADMIN-ORDERS QA FAILED\n - Missing admin-orders Edge Function")
    sys.exit(1)

text = PATH.read_text(encoding="utf-8")


def require(token: str, message: str) -> None:
    if token not in text:
        ERRORS.append(message)


# Origin and response hardening.
if '"Access-Control-Allow-Origin": "*"' in text:
    ERRORS.append("admin-orders still uses wildcard CORS")
require('const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";', "production origin is not locked")
require('"Cache-Control": "no-store"', "responses must be non-cacheable")
require('"X-Content-Type-Options": "nosniff"', "nosniff header is missing")
require('"Referrer-Policy": "no-referrer"', "referrer policy is missing")
require("MAX_BODY_BYTES", "request body size cap is missing")
require('includes("application/json")', "content-type validation is missing")

# Authentication and authorization.
require('Deno.env.get("TCB_ADMIN_EMAIL")', "server-side admin email allowlist is missing")
require('auth.getUser(token)', "JWT is not revalidated with Supabase Auth")
require('email !== adminEmail', "admin email authorization check is missing")
require('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', "service-role key must come from server environment")
if re.search(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]", text):
    ERRORS.append("service-role key appears hard-coded")

# Abuse protection.
require("consume_security_rate_limit", "authenticated admin rate limiting is missing")
require("300, 600", "admin rate-limit policy changed unexpectedly")
require("user.id", "rate-limit key should include authenticated user identity")

# Minimize accidental data expansion and preserve live schema compatibility.
if '.select("*")' in text or ".select('*')" in text:
    ERRORS.append("admin-orders must not use select(*)")
require('const NORMAL_ONLY_FIELDS = ["pincode", "delivery_slot"]', "normal-order field partition is missing")
require('const BULK_ONLY_FIELDS = ["event_type", "delivery_datetime"]', "bulk-order field partition is missing")
require("orderSelect(type)", "type-specific order projection is not used")

# Mutation integrity.
require('.eq("payment_status", "pending")', "payment confirmation lacks compare-and-set protection")
require('.eq("order_status", currentStatus)', "status transition lacks compare-and-set protection")
require('current.payment_status !== "paid"', "orders must not be accepted before payment is confirmed")
require('url.protocol !== "https:"', "tracking URL must be HTTPS-only")
require('.from("order_status_events").insert', "status audit event insert is missing")

# Keep lifecycle rules explicit server-side.
for token in [
    'new: ["accepted", "rejected", "cancelled"]',
    'accepted: ["preparing", "cancelled"]',
    'preparing: ["ready_for_pickup", "cancelled"]',
    'dispatched: ["delivered"]',
]:
    require(token, f"missing lifecycle rule: {token}")

if ERRORS:
    print("TCB STEP 2 ADMIN-ORDERS QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 2 ADMIN-ORDERS QA PASS")

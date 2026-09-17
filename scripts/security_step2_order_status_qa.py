#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "supabase/functions/order-status/index.ts"
ERRORS = []

if not PATH.exists():
    print("TCB STEP 2 ORDER STATUS QA FAILED\n - Missing order-status function")
    sys.exit(1)

text = PATH.read_text(encoding="utf-8")


def require(token: str, message: str) -> None:
    if token not in text:
        ERRORS.append(message)


# Browser boundary and response hardening.
if '"Access-Control-Allow-Origin": "*"' in text:
    ERRORS.append("order-status still uses wildcard CORS")
require('const PRODUCTION_ORIGIN = "https://ankitkashikar.github.io";', "production origin is not locked")
require('"Cache-Control": "no-store"', "responses must be non-cacheable")
require('"X-Content-Type-Options": "nosniff"', "nosniff protection is missing")
require('"Referrer-Policy": "no-referrer"', "referrer protection is missing")
require('includes("application/json")', "content-type validation is missing")
require("MAX_BODY_BYTES", "request body limit is missing")

# Customer credentials and enumeration resistance.
require('const ORDER_RE = /^CBD-[0-9]{4}-[0-9]{6}$/;', "TCB order-number validation changed unexpectedly")
require('const PHONE_RE = /^[6-9][0-9]{9}$/;', "phone validation changed unexpectedly")
require("consume_security_rate_limit", "rate limiting is missing")
require("ipRateKey", "per-IP rate limiting is missing")
require("30, 600", "per-IP lookup limit changed unexpectedly")
require("orderRateKey", "per-order brute-force limiter is missing")
require("8, 600", "per-order lookup limit changed unexpectedly")
require('`order-status:order:${ip}:${orderNumber}`', "per-order limiter must bind order number to client IP")

# Server-side privileged access only.
require('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', "service-role key must come from the function environment")
if re.search(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]", text):
    ERRORS.append("service-role key appears hard-coded")
require('.from("normal_orders")', "customer lookup must remain limited to normal direct orders")
require('.eq("order_number", orderNumber)', "lookup must require the exact order number")
require('.eq("phone", phone)', "lookup must require the exact customer phone")

# Do not expose broad rows or internal/customer PII in the response.
if '.select("*")' in text:
    ERRORS.append("order-status must not select full rows")
require('.select("product_name,quantity,unit_price,line_total")', "item response fields changed unexpectedly")
for forbidden in [
    "address: order.address",
    "name: order.name",
    "phone: order.phone",
    "notes: order.notes",
    "customer_id: order.customer_id",
    "id: order.id,",
    "rejection_reason: order.rejection_reason",
    "cancellation_reason: order.cancellation_reason",
]:
    if forbidden in text:
        ERRORS.append(f"customer response exposes forbidden field: {forbidden.split(':')[0]}")

# Tracking URLs shown to customers must be encrypted in transit.
require('return url.protocol === "https:" ? url.toString() : null;', "tracking URLs must be HTTPS-only")
if 'url.protocol === "https:" || url.protocol === "http:"' in text:
    ERRORS.append("plain HTTP tracking URLs are still allowed")

# Unknown order and wrong phone deliberately share one response.
require("Order not found. Check the order number and mobile number and try again.", "generic not-found response is missing")

if ERRORS:
    print("TCB STEP 2 ORDER STATUS QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 2 ORDER STATUS QA PASS")

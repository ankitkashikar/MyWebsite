#!/usr/bin/env python3
from pathlib import Path
import json
import random
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CONFIG = (ROOT / "supabase-config.js").read_text(encoding="utf-8")

url_match = re.search(r'const SUPABASE_URL = "([^"]+)";', CONFIG)
key_match = re.search(r'const SUPABASE_ANON_KEY = "([^"]+)";', CONFIG)
if not url_match or not key_match:
    print("TCB STEP 2 LIVE SMOKE FAILED\n - Could not read public Supabase browser config")
    sys.exit(1)

base = url_match.group(1).rstrip("/") + "/functions/v1"
anon = key_match.group(1)
origin = "https://ankitkashikar.github.io"
errors = []


def post(path: str, body: dict):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {anon}",
            "apikey": anon,
            "Origin": origin,
            "User-Agent": "TCB-Step2-Live-Smoke/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            status = response.status
            headers = dict(response.headers.items())
            raw = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        headers = dict(exc.headers.items())
        raw = exc.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return None, {}, None, f"network error: {exc}"

    try:
        payload = json.loads(raw)
    except Exception:
        payload = None
    return status, headers, payload, None


# Public customer lookup: use a future-year fake order number so it cannot
# collide with a real current order. This is read-only apart from limiter state.
fake_order = f"CBD-2099-{random.randint(900000, 999999):06d}"
status, headers, payload, err = post(
    "/order-status",
    {"order_number": fake_order, "phone": "9876543211"},
)
if err:
    errors.append(f"order-status {err}")
else:
    if status != 404:
        errors.append(f"order-status expected 404 for unknown order, got {status}")
    if not isinstance(payload, dict) or payload.get("success") is not False:
        errors.append("order-status did not return the expected safe failure payload")
    if not isinstance(payload, dict) or "Order not found" not in str(payload.get("message", "")):
        errors.append("order-status did not use the generic not-found response")
    if headers.get("Access-Control-Allow-Origin") != origin:
        errors.append("order-status live CORS origin is not locked to production")
    if headers.get("Cache-Control") != "no-store":
        errors.append("order-status live response is not no-store")

# Admin endpoint: the public anon JWT should pass the platform JWT gate but
# must fail handler-level user validation. Because the handler checks
# TCB_ADMIN_EMAIL before user validation, receiving the custom 401 below also
# proves the secret is configured and non-empty at runtime.
status, headers, payload, err = post(
    "/admin-orders",
    {"action": "list", "order_type": "normal", "limit": 1},
)
if err:
    errors.append(f"admin-orders {err}")
else:
    if status != 401:
        errors.append(f"admin-orders expected 401 for anon JWT, got {status}")
    message = payload.get("message", "") if isinstance(payload, dict) else ""
    if message == "Admin access is not configured yet.":
        errors.append("TCB_ADMIN_EMAIL is missing at runtime")
    elif message != "Your admin session is invalid or expired.":
        errors.append(f"admin-orders returned an unexpected auth response: {message or '<non-json>'}")
    if headers.get("Access-Control-Allow-Origin") != origin:
        errors.append("admin-orders live CORS origin is not locked to production")
    if headers.get("Cache-Control") != "no-store":
        errors.append("admin-orders live response is not no-store")

if errors:
    print("TCB STEP 2 LIVE SMOKE FAILED")
    for error in errors:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 2 LIVE SMOKE PASS")
print(" - order-status: public lookup reachable; unknown credentials return generic 404")
print(" - admin-orders: anon JWT rejected by handler; TCB_ADMIN_EMAIL is loaded")

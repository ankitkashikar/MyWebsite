#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []

FUNCTIONS = [
    ROOT / "supabase/functions/place-order/index.ts",
    ROOT / "supabase/functions/admin-orders/index.ts",
    ROOT / "supabase/functions/order-status/index.ts",
]

for path in FUNCTIONS:
    text = path.read_text(encoding="utf-8")
    if 'Access-Control-Allow-Origin": "*"' in text:
        ERRORS.append(f"{path.relative_to(ROOT)}: wildcard CORS is not allowed")
    if "SUPABASE_SERVICE_ROLE_KEY" not in text:
        ERRORS.append(f"{path.relative_to(ROOT)}: expected server-side service role usage missing")
    if "Cache-Control" not in text or "no-store" not in text:
        ERRORS.append(f"{path.relative_to(ROOT)}: sensitive API responses must use no-store")

admin = (ROOT / "supabase/functions/admin-orders/index.ts").read_text(encoding="utf-8")
if "TCB_ADMIN_EMAIL" not in admin or "email !== adminEmail" not in admin:
    ERRORS.append("admin-orders must enforce the single TCB admin email server-side")
if 'nextStatus === "accepted" && current.payment_status !== "paid"' not in admin:
    ERRORS.append("admin-orders must block order acceptance until payment is verified")

place = (ROOT / "supabase/functions/place-order/index.ts").read_text(encoding="utf-8")
for token in ["products", "payment_method !== \"upi\"", "DIRECT_DELIVERY_PIN", "idempotency_key"]:
    if token not in place:
        ERRORS.append(f"place-order missing required server validation: {token}")

migration = (ROOT / "supabase/migrations/20260917_security_hardening.sql").read_text(encoding="utf-8").lower()
for token in ["enable row level security", "revoke all privileges", "consume_security_rate_limit"]:
    if token not in migration:
        ERRORS.append(f"security migration missing: {token}")

orders = (ROOT / "orders.html").read_text(encoding="utf-8")
if "noindex,nofollow" not in orders:
    ERRORS.append("orders.html must remain excluded from indexing")
if "escapeHtml" not in orders:
    ERRORS.append("orders.html must escape customer-controlled values before HTML rendering")

# Look for credentials that must never be committed. The public Supabase
# anon/publishable key is intentionally excluded from this test.
all_text = []
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts:
        continue
    try:
        all_text.append(p.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        pass
repo_text = "\n".join(all_text)
for pattern in [
    r"sb_secret_[A-Za-z0-9_-]{16,}",
    r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]",
]:
    if re.search(pattern, repo_text):
        ERRORS.append("Repository appears to contain a committed server secret")
        break

if ERRORS:
    print("TCB SECURITY QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB SECURITY QA PASS")

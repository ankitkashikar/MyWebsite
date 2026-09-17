#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PREFLIGHT = ROOT / "supabase/diagnostics/20260917_step1b_preflight.sql"
ERRORS = []

if not PREFLIGHT.exists():
    print("TCB STEP 1B QA FAILED\n - Missing Supabase preflight SQL")
    sys.exit(1)

sql = PREFLIGHT.read_text(encoding="utf-8")

# Strip SQL line comments before checking executable statements.
without_comments = "\n".join(
    line.split("--", 1)[0] for line in sql.splitlines()
)
statements = [s.strip() for s in without_comments.split(";") if s.strip()]

allowed_starts = ("select", "with")
for statement in statements:
    first = statement.lstrip().lower()
    if not first.startswith(allowed_starts):
        preview = re.sub(r"\s+", " ", statement)[:100]
        ERRORS.append(f"Preflight contains non-read-only statement: {preview}")

# Keep production identity explicit so the diagnostic is not casually run on
# the separate TCB_Dashboard Supabase project.
if "ncbyfovvetvmkrlzapku" not in sql:
    ERRORS.append("Website Supabase project ref is not documented in the preflight")
if "friglfticlkpgcsothel" in sql:
    ERRORS.append("Dashboard Supabase project ref must not appear in website preflight")

for token, message in [
    ("information_schema.columns", "column inventory is missing"),
    ("pg_policies", "RLS policy inventory is missing"),
    ("role_table_grants", "table grant inventory is missing"),
    ("relrowsecurity", "RLS state inspection is missing"),
    ("relforcerowsecurity", "forced-RLS inspection is missing"),
    ("pg_get_constraintdef", "constraint inspection is missing"),
    ("pg_indexes", "index/idempotency inspection is missing"),
    ("MISSING_REQUIRED_COLUMN", "required-column blocker report is missing"),
    ("payment_status", "payment-status compatibility inspection is missing"),
    ("order_status", "order-status compatibility inspection is missing"),
    ("idempotency_key", "idempotency compatibility inspection is missing"),
    ("consume_security_rate_limit", "rate-limit RPC privilege inspection is missing"),
    ("has_function_privilege('anon'", "anonymous RPC privilege check is missing"),
    ("has_function_privilege('authenticated'", "authenticated RPC privilege check is missing"),
    ("has_function_privilege('service_role'", "service-role RPC privilege check is missing"),
]:
    if token not in sql:
        ERRORS.append(message)

# This first pass must not read customer/order rows. Exact status and duplicate
# checks are deliberately performed later, after live schema existence is known.
for forbidden in [
    "from public.customers",
    "from public.normal_orders",
    "from public.normal_order_items",
    "from public.bulk_orders",
    "from public.bulk_order_items",
]:
    if forbidden in without_comments.lower():
        ERRORS.append(f"Metadata preflight unexpectedly reads application rows: {forbidden}")

if ERRORS:
    print("TCB STEP 1B QA FAILED")
    for error in ERRORS:
        print(f" - {error}")
    sys.exit(1)

print("TCB STEP 1B QA PASS")

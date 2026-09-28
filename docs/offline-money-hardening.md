# Step 2: integer-paise monetary hardening

Date: 2026-09-20. Branch: tcb-offline-pricing-audit.
Supersedes the open monetary findings in the Step 1 audit; that audit remains
a historical record of the unmodified baseline.

## Implemented

- Catalogue prices accept positive decimal numbers or canonical decimal strings
  with at most two fractional digits. Null, booleans, objects, blank strings,
  non-finite values, negatives, zero, exponent/hex strings, padded strings,
  and fractional-paise prices fail closed. There is no silent rounding.
- Parse rupee and fractional digits separately into integer paise; multiply
  quantities and sum line totals entirely in paise.
- Guard unit, line, subtotal and final values with a technical ceiling of
  9,999,999,999 paise (the numeric(10,2) range), plus safe-integer checks.
  This is a conservative storage-compatible bound, not a new business
  order-value policy or a claim that all live schema types were verified.
- Reject non-positive new-order totals. Existing idempotent order responses
  and historical records are unchanged.
- Convert to rupees only at the persistence/API boundary. Existing field names
  and the pending-payment rule are preserved. Discount and delivery fee remain
  zero pending their separate implementation; no charge policy was invented.
- Return a generic pricing error before customer/order writes for invalid
  catalogue data. Rate limiting still executes before pricing as before.

## Verification

```sh
node scripts/place_order_offline_audit.mjs
python3 scripts/security_step1a_qa.py
git diff --check
```

Results: 95 handler checks passed; existing Step 1A static security QA passed;
diff whitespace check passed. Tests cover normal and bulk orders, invalid
price types/values, fractional-paise rejection, decimal totals, mixed and
duplicate lines, upper boundary acceptance, line/aggregate overflow rejection,
and the earlier tampering checks. The database double now records customer
upserts too, verifying invalid pricing causes no application-data writes.

The actual handler is executed offline with an in-memory database double.
Live PostgreSQL precision/constraints, Deno/Supabase integration and browser
checkout acceptance remain unverified. This is not production acceptance.
No remote push, migration, deployment or production API write was performed.

## Next step

Implement server-side coupon validation offline, including independent
revalidation during order creation and fake/expired/ineligible coupon tests.

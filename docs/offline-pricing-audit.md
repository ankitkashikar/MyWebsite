# Step 1: offline order-pricing audit

Date: 2026-09-20. Audited baseline: c263a281ff391f056340fc3e74446db403de7fc4.
Branch: tcb-offline-pricing-audit. No production changes or requests made.

## Changes and verification

Added scripts/place_order_offline_audit.mjs, which executes the actual
place-order handler using Node 24 TypeScript stripping and an in-memory
Supabase double. Network access and real credentials are not supplied to
the handler. Application code is unchanged.

Run:

```sh
node scripts/place_order_offline_audit.mjs
python3 scripts/security_step1a_qa.py
```

Result: 19 behavioral protection checks passed; existing Step 1A static
security QA passed. Known-gap observations are reported separately and
are NOT passing security acceptance tests.

Verified: normal and bulk orders ignore forged item prices, totals,
discounts and paid state; persisted item prices come from database fixtures;
normal invalid quantities are rejected; missing, inactive and wrong-channel
products are rejected; duplicate product lines are consolidated; existing
idempotency keys return the stored order without inserts; normal PIN and
UPI-only restrictions are enforced.

## Findings

1. Server-authoritative product pricing already exists. Do not rebuild it.
2. Price validation permits zero and coerces null to zero. Both produced
   zero-total orders in the offline handler. This is a catalogue integrity
   risk, not evidence that browser-supplied prices override the database.
   Calculations also use floating-point rupees without explicit minor-unit
   validation or safe-integer bounds.
3. Fake coupon codes are stored without validation (discount remains zero).
   Coupon objects are coerced to text. No unauthorized discount was observed,
   but the required coupon rejection/eligibility flow is absent.
4. Delivery fees are fixed at zero; tax/fee policy is not implemented here.
   Confirm business policy before introducing charges.
5. Arbitrary normal delivery-slot text passes. Bulk date/time is only checked
   for presence. Scheduling/hours validation remains unfinished.
6. Idempotency lookup exists, but it is not bound to a request fingerprint.
   Concurrent retries and database uniqueness need separate verification.
7. Order-header and line-item writes are separate, with compensating deletion
   on item failure. Atomicity is not established by this test harness.
8. Body-size enforcement checks the declared Content-Length only; actual
   streamed size is not bounded before req.json(). Follow-up required.

## Limits

These tests do not verify PostgreSQL constraints, transactions, RLS, real
Supabase/Deno integration, browser DevTools behavior, concurrent replay,
the deployed handler version, or production readiness. The mock implements
only the database behavior needed for these successful/rejected cases.
Secrets audit and full checkout QA remain pending. No Supabase project was
accessed, and no application changes were deployed or pushed.

## Exactly one next step

Harden server-side monetary calculation offline: validate authoritative
catalogue prices, calculate in integer paise, reject invalid/zero totals
for the current paid-order flow, and test rounding and invalid-price cases.
Then report results before moving to coupon implementation. Keep all work
offline until development and local acceptance are complete; production
merge/release requires explicit approval.

# Step 3: server-side coupons (offline)

Implemented on tcb-offline-pricing-audit. No production changes or promotions.

## Behavior

- New `validate-coupon` Edge Function takes one code, order type, phone and
  product IDs/quantities. It never uses client prices, totals or discounts.
- Database `quote_coupon` retrieves prices and coupon rules. Rejects missing,
  inactive, future, expired, wrong-channel and ineligible coupons. Checks
  minimum subtotal, product/category eligibility, discount caps, global usage
  and per-phone usage. One code per order; coupon objects/arrays are rejected.
- Flat discount values use paise; percentage values use basis points. Fractions
  of a paise are rounded down. A discount cannot create a zero-total order.
- Product and category restrictions intersect when both are set. Discount
  applies only to eligible lines; minimum spend uses the complete subtotal.
  A separate service-only category mapping avoids assumptions about legacy
  category columns. Missing category mappings cannot grant category discounts.
- Order creation independently quotes again; a BEFORE INSERT database trigger
  rechecks current products/policies and requires matching monetary fields.
  The coupon row is locked through insertion to serialize quota consumption.
  Stale quotes fail rather than silently changing payable amounts.
- Preview quotes do not consume uses. Existing order headers count across normal
  and bulk orders, including pending/cancelled orders. This conservative policy
  does not automatically restore uses after cancellation/refund. Deleted failed
  headers no longer count. Changing that policy is separate business work.
- Per-phone quotas use the submitted phone; they do NOT establish customer
  identity or stop someone using a different number. Verified per-person quotas
  require an authentication/OTP design, which is not implemented here.
- Coupon tables have forced RLS, no browser grants, and service-only RPC access.
  Public responses exclude coupon definitions, internal usage and admin data.
  Endpoint has a 30-per-10-minute rate limit, actual 8 KB streamed-body limit,
  production CORS, explicit JWT configuration, security headers and no caching.
- Normal and bulk checkout now call the Edge Function instead of the missing
  /api/coupons/validate route. Cart/phone changes invalidate the displayed quote;
  an in-flight quote is discarded if those details change.
- `admin.html` remains a preview. Its local coupon definitions have no authority.
  This change does not add public or administrative coupon-creation endpoints.

## Tests completed

- 55 offline PostgreSQL/handler checks passed using PGlite 0.5.8 with a minimal
  fixture schema. The actual SQL migration, quote function, insert triggers,
  validate-coupon handler and place-order handler were executed.
- Includes fake/expired/ineligible codes; fabricated objects and stacking;
  flat/percentage/capped/partial discounts; invalid quantities/products/phones;
  quotas and stale quotes; deactivation and changed discounts after preview;
  transaction rollback; denied anon/authenticated access; service-role access;
  HTTP size/content/method/rate guards; order persistence and idempotent retry.
- 98 existing/extended order-protection checks passed.
- Existing Step 1A security QA and static website QA passed (0 errors/warnings).
- Changed inline JavaScript and browser helper compile without syntax errors.

Reproduce backend checks (Node 24+):

```sh
npm install --prefix /tmp/tcb-coupon-runtime --no-audit --no-fund @electric-sql/pglite@0.5.8
PGLITE_MODULE=/tmp/tcb-coupon-runtime/node_modules/@electric-sql/pglite/dist/index.js node scripts/coupon_offline_qa.mjs
node scripts/place_order_offline_audit.mjs
python3 scripts/security_step1a_qa.py
python3 scripts/qa_check.py
```

## Pending verification and release constraints

The browser test is written but could not run: Chromium was absent and its
Playwright download timed out. Do not count it as passed. To run with Playwright
and Chromium installed, serve this checkout on 127.0.0.1:4173 and execute
`node scripts/coupon_browser_qa.mjs`. It intercepts coupon calls and blocks all
external traffic. It is an integration smoke test, not full checkout acceptance.

PGlite uses a fixture schema and serial execution. Real multi-connection quota
contention, live schema compatibility and deployed Deno/Supabase behavior are
not verified. The row-lock design still needs concurrency acceptance. The
existing order-header/item writes are not one transaction; that existing
atomicity/idempotency gap is not resolved by this coupon change.

Before any eventual approved deployment, verify migration compatibility with
TCB_Website_DB and apply the new migration before the function/frontend release.
The migration creates no active coupons. Keep all work offline for now; no
migration, remote push, production request, merge or deployment was performed.

## Exactly one next step

Complete local browser checkout/tampering acceptance, including coupon UI,
DevTools changes and modified network payloads, once Chromium is available.

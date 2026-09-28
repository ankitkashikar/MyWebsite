# Step 4: local checkout and tampering acceptance

Date: 2026-09-20. Branch: tcb-offline-pricing-audit.

## Result

82 checkout/tampering checks passed in Chromium 153.0.8010.0 against the
actual place-order and validate-coupon handlers and local PGlite PostgreSQL
fixture. Both normal and bulk ordering were exercised at 390px and 1280px.
The 4 coupon UI scenarios also passed. The shared-fixture refactor preserved
all 55 coupon database/handler checks.

This resolves the Chromium/browser-verification blocker documented in
`offline-coupon-validation.md`. The other release constraints in that report
remain in force.

## What was exercised

- Actual clicks through quantity selection, fixed cart bar, drawer, details,
  normal scheduled delivery / bulk date entry, coupon, payment and confirmation.
- Invalid phone/address inputs stop navigation before submitting an order.
- Valid coupon amounts displayed at payment agree with the server fixture.
- Stored order and item amounts agree with authoritative database pricing.
- Payment remains pending; success copy says payment needs confirmation.
- Browser-originated modified HTTP requests with zero/negative item prices,
  forged subtotal/total, huge discounts, 100% discount, delivery charges,
  payment amount, paid status and payment reference cannot alter saved totals.
- Fake, expired, product-ineligible, object and stacked coupons are rejected.
- Unknown/unavailable products, zero/negative/decimal/excessive quantities,
  invalid phone/address, COD and unserviceable normal PIN are rejected.
- Rejected requests do not add an order. A replay of the same completed order
  returns the original record without adding another order.
- DevTools-equivalent edits to DOM product prices, JavaScript coupon state and
  displayed payable amount followed by the actual confirmation button still
  save the legitimate database amount.
- Failed/stale coupon submissions show an error rather than a success screen.
- Cart/phone changes invalidate applied coupon quotes in both screen sizes.
- No uncaught application JavaScript errors during the tested flows.

The browser suite waits for the real post-success cart reset before simulating
another checkout. This avoids confusing the app's existing delayed reset with
an attack result.

## Implementation and reproducibility

Added a self-contained localhost static server and extracted the existing SQL
fixture/handler adapter into `scripts/offline_order_runtime.mjs`. Both backend
and browser tests now use the same fixture. No application behavior changed.
All non-local browser traffic is intercepted or blocked. Order/coupon requests
are fulfilled by executing the real handlers locally; they are not sent to
Supabase. Database writes exist only in the disposable PGlite instance.

With Node 24+, Playwright/Chromium and PGlite 0.5.8 installed:

```sh
node scripts/coupon_browser_qa.mjs
node scripts/checkout_tampering_browser_qa.mjs
node scripts/coupon_offline_qa.mjs
```

If dependencies are installed outside the project, PGLITE_MODULE can point to
PGlite's dist/index.js. CHROMIUM_MODULE can point to the default export of an
installed @sparticuz/chromium build/index.js. This run used that package's
Chromium 153 binary because the standard Playwright CDN download timed out.
The package's tar files were extracted without restoring archive ownership.
Browser launch kept normal web security enabled and did not use single-process
mode. Tests start and close their own localhost server.

## Open findings / scope limits

**Release blocker: both checkout pages still build the UPI link with
`yourbusiness@upi`.** This is a placeholder, not a confirmed business payment
recipient. No real transfer was attempted and no payment account was invented.
Replace it with verified business details before approving release.

Displayed UPI amounts still originate from client cart calculations. The tests
prove those edits cannot change the persisted amount or trusted payment status;
they do not establish payment settlement or automatic amount verification.

The local database schema is a fixture, not a copy of production. Supabase JWT
gateway, real SQL schema compatibility, rate-limit persistence and live services
were not exercised. The rate-limit RPC is stubbed in the browser harness so
attack cases can reach the validation logic; deterministic rate-limit tests are
in the separate coupon suite. Genuine simultaneous database connections,
transactional header/item writes and payload-bound replay protection remain
pending. Sequential retry passing is not concurrency acceptance.

No real UPI app, payment transfer, live customer order lookup, production
credentials, production database, remote push, merge or deployment was used.
This is local checkout acceptance, not a declaration of production readiness.

## Exactly one next step

Harden duplicate/replay handling and atomic order creation, then test concurrent
requests and item-write failure rollback offline.

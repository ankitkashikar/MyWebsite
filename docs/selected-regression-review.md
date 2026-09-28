# P18 — selected-feature regression review

26 September 2026. Scope: selected website functionality, excluding held menu, images, business prices/offers and payments. Production unchanged. Test-only changes in this review.

## Evidence and coverage

| Area | Current evidence | Limit |
| --- | --- | --- |
| Checkout/API, replay, forged values, invalid scheduling, rate limit | Owner previously reported 38 real local Supabase checks passed; P17 admin suite subsequently completed | Latest supplied output is the 85-check admin summary, not a fresh standalone checkout transcript |
| Admin authorization, delivery/coupons, Customers, kitchen alerts, operations and tracking | Owner reported 85 checks passed, exit 0 after P17 support-reference test fix | Local synthetic data; desktop/mobile Chromium sizes 390/1280 |
| Normal/bulk schedule boundaries and IST | Offline normal/bulk handler suites and 35 device-timezone cases | Mock runtime, not separate clients |
| Tracking display/refresh | 13 API/DOM checks; includes two new hidden-tab and overlapping-request checks | Simulated clock and browser DOM |
| Kitchen alerts | 10 API/DOM checks | Mock audio; physical device audibility and sleeping browser behavior not verified here |
| Customers privacy and rendering | 14 database/API +7 DOM checks | Synthetic contact data, no production reads |
| Admin startup | 2 DOM checks | Mock Auth/API |
| Failure references and messages | 7 monitoring checks; real local safe-not-found reference check accepted by owner | Application errors only; gateway/runtime failures need operational investigation |
| Coupon authorization/audit and delivery configuration | 13 coupon +13 delivery database/API checks | Synthetic values only; does not configure business prices or offers |
| Migration compatibility | 25 PGlite upgrade checks | No real Supabase migration ledger/PostgREST/concurrency verification |
| Independent DB concurrency and recovery | Prior owner reports: 11 independent-connection scenarios and 12 Docker recovery checks | Prior evidence, not rerun here; synthetic fixture/data limitations still apply |
| One coupon per order | Existing coupon validation and checkout-tampering suites contain stacked-code rejection tests | Rule remains unchanged; no new claim of those older browser suites running in this review |

## Gaps closed now

P17 introduced console.warn for safe logging. Older mock runtimes implemented only console.error; six selected suites failed before reaching security/business assertions. Updated the test doubles (including shared/related offline fixtures) without changing application logging. Dedicated monitoring tests still inspect the log field allowlist.

Added direct tests proving hidden tabs make no automatic tracking requests and resume on the next visible interval, and that a slow lookup blocks overlapping manual/scheduled requests. Both pass against current page code.

Added scripts/selected_regression_qa.mjs as a repeatable entry point for 12 selected offline suites. It reports each suite, fails on errors/timeouts and returns nonzero if any fail. No deployment or network calls are part of this runner. See selected-regression-results.txt for this run's output.

## Remaining release validation

- Final real-local regression against the exact release candidate after remaining selected configuration/content work. Current test-only edits do not require rerunning unchanged Supabase acceptance immediately.
- Manual keyboard/accessibility and real mobile browser checks, including audible kitchen alert behavior with explicit sound permission, reconnect and background/sleep limitations. Current Chromium viewport tests do not establish Safari/physical-device coverage.
- Production configuration and recovery review, then approved rollout and live smoke/acceptance. Local evidence cannot mark these passed.
- Held menu/images/prices and real payment integration/recipient/refund/bulk-balance acceptance remain blocked until owner resumes them. Real payment tests cannot be completed using synthetic confirmation.
- Business details, links and policy confirmation (P4–P7) remain tracked; P18 does not remove them.

Next: P19 read-only production-configuration readiness review and preparation. Do not deploy or change production secrets/settings. P18's selected offline review is complete when all 12 suites pass; final release regression remains pending.

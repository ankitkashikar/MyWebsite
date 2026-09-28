# Mandatory production approval gate

User instruction (20 September 2026): before production deployment, remind
Ankit about the UPI placeholder.

Before requesting approval to merge or deploy:

1. Explicitly remind Ankit that both checkout pages use `yourbusiness@upi`.
2. Obtain verified business payment details; never guess a UPI recipient.
3. Replace the placeholder and test the UPI recipient, amount and payment-pending
   messaging on mobile and desktop. Run `python3 scripts/release_preflight.py`.
4. Review all outstanding technical acceptance evidence, including independent
   PostgreSQL connection contention, live schema compatibility, delivery rules,
   auth-security follow-up and deployment/public-site verification plan.
5. Present concrete changes and test evidence, then obtain explicit production
   approval. The preflight passing alone never authorizes deployment.

A conditional UPI reminder is configured as an additional reminder. The checklist
is mandatory regardless of whether the notification has fired. Do not deploy
while waiting for it or treat it as automatic approval.

All development remains offline. Website Supabase project only; do not touch
TCB_Dashboard or unrelated projects. No production deployment is authorized by
this checklist.

## Continuation — 21 September 2026

Payment selection/implementation is deferred at the owner's request while
independent work continues. It remains a release blocker, not a waived gate.
Retain one-step branch work, tests, result reporting, and explicit approval
before production merge/deployment.

User-reported local evidence: 18 checkout/API checks and 54 normal/bulk
operations/Auth/tracking checks passed with exit code 0. Payments were synthetic.
Do not repeat completed suites merely because the older handoff lists them pending.

Public HTTP smoke tooling is now prepared; see `public-site-smoke.md`.
Actual live availability verification remains pending until a successful run.

Remaining release work includes payment verification and bulk advance/balance
handling; delivery fee rules; server-enforced scheduling in Asia/Kolkata;
verified content, products/prices, imagery and restaurant/social links;
final policy/business details and notification scope; production migration
history reconciliation; deployment/rollback plan and release smoke evidence.
The exact bulk lead time within the documented 1–2 days needs a business decision.

Location discrepancy: the uploaded handoff says Kharadi, but
`CONTENT_BUSINESS_REVIEW.md` records owner-confirmed Hinjewadi Phase 1, 411057,
and explicitly says not to replace it with Kharadi. Preserve the confirmed details.

## Continuation — 23 September 2026

- Owner reports restoring public repository visibility; fresh seven-page public
  probe still returned 404 on all pages and logo. Do not mark hosting restored.
- Expanded smoke checks on `tcb-navigation-smoke` include explicit index.html,
  five policy pages and bounded internal navigation. Twelve offline tests pass;
  static QA has zero errors/warnings. No production changes were made.
- Payment remains deferred. See `payment-options.md` for the current shortlist
  and normal/full-payment versus bulk/advance-balance requirements.
- Immediate next step: inspect GitHub Settings → Pages publishing source and
  latest Pages deployment result. Any restoration deployment must target an
  explicitly approved production revision, not the pending development branch.

## Continuation — delivery timezone correction

- Owner reports GitHub Pages restoration worked. Independent HTTP verification
  remains pending: this environment's follow-up requests timed out.
- Owner directs payment gateway work to be the final implementation stage before
  production approval. It remains mandatory; no release waiver is implied.
- Development branch `tcb-india-delivery-slots` corrects normal checkout's slot
  picker to use Asia/Kolkata calendar dates and time labels on every device.
- `node scripts/delivery_timezone_qa.mjs`: 35 fixed-clock cases pass across five
  device timezones, covering opening, half-hour rounding, midnight/year rollover,
  and tomorrow's slots. Static QA passes with zero errors/warnings.
- Scope: browser picker only. Server-enforced scheduling remains pending;
  do not claim the API scheduling blocker is resolved. Bulk lead-time policy
  still needs an exact business decision. No payment changes or deployment.
- Next development step: enforce confirmed normal-order scheduling rules in the
  API while preserving idempotent retries, then test rejection boundaries.

## Backend normal-order scheduling — development only

Branch `tcb-backend-scheduling`:
- Normal ASAP orders accepted only during 16:00–24:00 Asia/Kolkata.
- Scheduled normal orders require an actual YYYY-MM-DD date, today/tomorrow in
  India, a not-yet-started half-hour window, and a start from 16:00 to 23:30.
  Midnight is permitted only as the ending boundary of the 23:30 slot.
- Checkout sends/stores the date in the slot label, preventing relative labels
  from changing meaning overnight. Old relative labels are rejected for new
  requests. Previously saved requests still replay unchanged.
- Scheduling validation follows canonical request lookup: saved retries remain
  valid after expiry and changed retries still receive 409. No schema migration.
- 18 handler schedule cases, saved/changed retry cases, and generated browser
  slot contract checks pass. The 35 device-timezone cases and static QA also pass.
  Handler checks stub database access; they do not establish live acceptance.
- Existing normal-order integration fixtures now send dated future slots.
  Rerun checkout and operations suites in local Docker before release; previous
  18/54 results apply to the earlier revision, not this scheduling change.
- Deploy matching menu and function revisions together after approval. An old
  cached menu sending relative scheduled labels fails closed and needs refresh.
- Bulk date/lead-time validation is NOT completed by this normal-order change;
  exact lead time remains a business decision. Payment remains the final planned
  implementation stage before release testing and explicit production approval.

Next step: run the updated local Supabase checkout/API and operations acceptance
suites against this revision. Nothing has been pushed, merged or deployed.

## Scheduling acceptance rerun package

Docker is unavailable in the assistant environment; full local acceptance has
not been rerun. Offline scheduling/contract, timezone and static checks pass.
Both local runners now refresh copied Edge Function sources before startup,
including on --resume, so an old place-order handler cannot silently be tested.
Refresh rejects unmarked/linked projects and preserves DB/config credentials.
The checkout suite now expects 30 checks (previous 18 plus 12 API scheduling
rejections across two widths); operations still expects 54. Both require exit 0.
Package: TCB-scheduling-qa-update.zip; extract into the existing laptop project.
Payment, bulk lead-time and production acceptance remain excluded.


## 23 September — bulk advance notice (supersedes earlier undecided lead-time notes)

User authorized a market-informed rule. Minimum notice is now **24 elapsed hours**,
using Asia/Kolkata for customer-entered times. Comparable policies vary from 24 to
48 hours; this is TCB's chosen rule, not a universal industry standard.
The form, public policy and place-order handler enforce it. Offset-less API input
is treated as India time; stored timestamps are explicit UTC instants. Existing
saved-request lookup remains before temporal validation so retries do not expire.
No order-capacity guarantee or size-tier rule has been added.

User-reported previous acceptance: 30 checkout/API and 54 operations checks passed
with exit code 0. New bulk boundary/handler checks, browser contract checks across
three host timezones, normal scheduling and static QA passed. Docker unavailable
here: NEW local integration acceptance remains pending (38 checkout/API checks,
54 operations checks). Payment integration remains last, before final acceptance
and explicit production approval. No push, merge or deployment.

Market references checked 23 September 2026:
- https://eataroundthecorner.in/catering.html — 24-hour notice.
- https://greensoulkitchens.in/faq/ — at least two days for bulk/party orders.


## 23 September — admin-managed delivery fees (development only)
User requested Delivery Settings on admin.html alongside coupons. Implemented
admin-only database rules and server/transaction-calculated checkout charges.
No real fees seeded; missing/disabled/deleted rules block new orders.
Coupon admin was a fake sessionStorage demo; now disabled pending backend work.
See docs/admin-delivery-settings.md for security, test evidence and local run steps.
Previous user run: 54 operations passes, exit 0; 38 checkout passes reported,
checkout exit line truncated. New 38+64 acceptance remains pending.
Payment gateway integration stays last; no production push/merge/deploy authorized.

## 24 September — secure coupon admin (development only)
Delivery acceptance reported by user: 38 checkout passes and 64 operations passes,
operations exit 0. Coupon CRUD/enable-disable, versioned admin writes and immutable
audit events now implemented on admin.html. Archived codes cannot be reused;
old order discounts and retries remain intact. No real coupons seeded.
13 database/API checks passed; fresh static/syntax QA passed. Full local 38+78
acceptance remains pending. See docs/secure-coupon-admin.md for exact continuation.
Payment gateway remains last; no production push/merge/deploy performed.


## 24 September — public content cleanup
User reported 78 coupon/delivery/operations checks passed, exit 0. Public content
review now removes unverified proof claims and random founder content; generic
platform links replaced with honest app-search guidance. Source menu/checkout
logic preserved. Static QA: zero errors/warnings. See public-content-review-20260924.md
for full inventory and remaining owner inputs. Five bulk sample rows still block
release; real menu/prices must replace them. Real photos/platform URLs also pending.
No production push/merge/deploy. Payment remains last. Next: owner bulk catalogue.

## 26 September — P19 configuration readiness

See production-configuration-readiness.md for the current source-verified settings, account-level checklist, six pending migrations, CI/hosting gaps and retained release holds. P17 local acceptance and P18 12/12 offline suites passed. P19 preparation is complete; live settings have not been verified or changed. The UPI release guard remains blocked as intended. Next is P20 rollout preparation, not deployment.

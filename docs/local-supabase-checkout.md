# Full local Supabase checkout/API acceptance — passed on user laptop

2026-09-20: this workspace has no Docker, Supabase CLI or Deno executable.
Execution here was blocked. The user subsequently supplied laptop output showing
all 18 checks passing with exit code 0 after the readiness correction. This is
user-provided execution evidence, not a run performed in this workspace.
Previous PGlite/browser evidence remains separate.

## Prepared scope

Run from a fresh extracted project using Git Bash, Node 24+ and Docker Desktop:

```bash
bash scripts/run_local_supabase_qa.sh
```

The script checks Docker first, prepares an unlinked local project, installs
Supabase CLI/pg/Playwright and Chromium, starts Supabase, serves copied Edge
Functions, runs the tests, and stops local services on exit. Initial image
and dependency downloads require internet. No Supabase login/link is needed.
Local ports 55320–55322 and 4173 must be free; no other tcb-checkout-qa stack
should be running. Existing .local-supabase-qa directories are refused; use a
fresh extracted directory to rerun, and retain a failed run for investigation.
Supabase stop preserves local data; this script does not delete Docker volumes.
Never link or deploy this disposable project.

Prepared tests exercise real browser requests at mobile/desktop sizes for both
normal/bulk pages: coupons, checkout, saved totals/items/pending payment, retries,
conflicting retries, forged amounts/status, fake coupons, gateway JWT denial and
real database rate limiting. Success expects **18 checks** and exit code 0.
Failures must be investigated before acceptance is recorded.

The schema export is the baseline migration, followed by only the two new
ordered migrations. Production historical migrations are not replayed.
Copied Edge Function CORS origins are changed to http://127.0.0.1:4173;
production source files remain unchanged. Browser configuration is rewritten
only in the local HTTP response to use the local API/anon JWT. Browser traffic
outside loopback ports 4173/55321 is blocked. No handler/database stubs are used.
The local Postgres connection is limited to port 55322. Synthetic catalogue,
coupon and customer rows are used. Rate-limit rows are cleared between test
scenarios; the final scenario checks the unmodified 12-request rate limit.
No UPI app is opened and no payment is transferred.

Keep status.json and functions.log locally; status.json contains local keys.
Share the PASS lines, final count/exit code, or a redacted error. Do not upload
credentials. The package leaves production payment details unchanged.

Not covered: live deployment, migration history reconciliation, real UPI
recipient/payment verification, operations Auth/console flows, independent
concurrency against this schema, or production-origin CORS acceptance.

CLI reference: https://supabase.com/docs/reference/cli/supabase-start
and https://supabase.com/docs/reference/cli/supabase-functions-serve

## Readiness fix after first laptop run

The original probe incorrectly expected success:false from validate-coupon,
whose error contract is valid:false. It could never accept the correct response.
The probe now uses GET and expects HTTP 405 plus valid:false; GET deliberately
avoids consuming coupon rate limits. This checks gateway/handler readiness, not
database health; subsequent checkout tests exercise the database. The contract
was verified against the actual handler with a denied mock rate limiter.
The subsequent laptop run passed all 18 checks with exit code 0.

To resume the prepared, unlinked project without recreating it:
`bash scripts/run_local_supabase_qa.sh --resume`.
The resume path requires the QA marker and refuses a linked project. It preserves
existing local data. Exit 15 in the original log followed the runner's cleanup;
it does not identify the original readiness failure. CPU-limit log messages
remain an observation to revisit if requests fail after correcting the probe.

## Accepted laptop result

The supplied transcript reports: gateway rejection of missing credentials;
normal and bulk checkout at widths 390 and 1280; stable retries and conflicting
retry rejection; authoritative saved amounts and pending payment despite forged
fields; fake coupon rejection; and rejection of the thirteenth rate-limited
request. Final line: "18 local Supabase checkout/API checks passed. UPI transfers
and production acceptance are excluded." Exit code: 0.

The CLI also reported deprecated [inbucket] configuration and network-accessible
0.0.0.0 service bindings. Browser requests were loopback-restricted, but Docker
services must not be described as loopback-bound. These notices did not prevent
this run from passing. No production acceptance or actual payment is established.

Next development step: verify local operations sign-in, Order Console updates
and customer order-status lookup end to end against this same Supabase schema.
Production approval, migration history reconciliation and the verified UPI
recipient/payment flow remain outstanding. Nothing was pushed or deployed.

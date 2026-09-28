# Local operations/Auth/tracking acceptance

The prior 18 checkout/API checks and 28 normal-order operations checks passed
on the user laptop with exit code 0. The expanded 54-check normal/bulk suite is
prepared, not execution-verified: Docker remains unavailable in this workspace.
Development application source now supports bulk operations and tracking. No
production account, payment recipient or deployment was changed. JavaScript/shell syntax and local setup checks are separate evidence.

## Install the update into the existing project

Extract TCB-bulk-operations-update.zip into the folder that already contains
scripts, docs, supabase and .local-supabase-qa:

D:\Personal Projects\TCB-local-supabase-qa\MyWebsite-local-supabase-qa

The ZIP contains updated orders.html, order-status.html, the order-status Edge
Function, and scripts/docs updates. Allow replacement of the
readiness script; it includes the verified GET/405/valid:false fix. It contains
no database files, local keys or account credentials.

With Docker Desktop running, use Git Bash:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_operations_qa.sh --resume
echo "Exit code: $?"
```

Do not run alongside another QA suite: these share local ports and project ID.
The runner refuses linked projects, requires the local QA marker, keeps existing
local data, and stops this local stack when it exits. It adds a copied
admin-orders function with local CORS and a generated local-only operations email.
The functions process receives that email via a local env file. Existing
production admin configuration is never read or changed.

npm installs pg, Playwright, Supabase CLI, esbuild and the real supabase-js SDK.
The SDK is bundled locally; only the HTML response substitutes the CDN import.
All browser requests are restricted to loopback ports 4173 and 55321. The actual
Auth, gateway, Edge runtime, PostgREST and PostgreSQL serve requests; none are
stubbed. Docker bindings may still be network-accessible as the CLI reports.

## Prepared 54 checks

Two shared checks reject an anon JWT and an authenticated non-operations user.
For each order type (normal and bulk) at 390px and 1280px, thirteen checks cover:

- Invalid-password rejection and successful operations sign-in with real Auth.
- A normal or bulk order created through place-order appearing in the console.
- Rejection of unpaid acceptance through both UI and API.
- Synthetic payment confirmation through the console, verified in the database.
- Accepted, preparing, ready, dispatched and delivered transitions through UI;
  each verifies the saved status and audit event.
- Rejection of changes out of terminal delivered status.
- Customer browser lookup reflecting Delivered and Payment Confirmed with items.
- Wrong-phone/unknown-order responses matching; sensitive fields absent from
  successful customer lookup.
- Sign-out returning to the login screen.

Success requires the final count **28** and exit code **0**. Share only results
and redacted errors, not status.json or local credentials. Synthetic Auth users
are removed on normal/error cleanup; an interrupted process may leave them in
this disposable local stack. Synthetic order/audit rows are intentionally kept.
No actual UPI payment occurs: paid state is synthetic local acceptance data.

## Scope boundaries

The expanded suite covers normal and bulk operations/customer tracking.
Rider assignment, rejection/cancellation flows, session
expiry/revocation, production-origin CORS, live migration history and real
payment verification remain outside these checks. Production approval remains
pending. Do not interpret a future pass as authorization to deploy.

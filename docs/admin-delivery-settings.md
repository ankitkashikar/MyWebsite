# Admin delivery settings — development handoff

Delivery Settings belongs in `admin.html`, alongside coupons, not in the Order
Console. Existing coupon management was a sessionStorage demo with fake login.
This change removes that login and disables the unfinished coupon controls with
an explicit setup-pending notice. Coupon validation at customer checkout remains.

## Implemented rule
- Exactly one current rule for normal orders and one for bulk orders.
- Admin sets fee, optional free-delivery threshold, and enabled status.
- Eligibility uses subtotal after coupon discounts, excluding delivery.
- Missing, disabled or deleted rules block new quotes/orders. No production seed.
- Delete retains an internal tombstone/version and audit history; admin can recreate.
- Auth uses Supabase Auth; existing `TCB_ADMIN_EMAIL` is rechecked by admin-orders.
- Database tables and RPCs deny anon/authenticated direct access. Service-role
  credentials stay on server. Actor is taken from verified user ID.
- Mutations and audit insertion commit together. Versions reject stale admin edits.
- Checkout fetches a server quote before showing payment. Final orders verify
  expected total and rule version and independently calculate fee inside atomic
  SQL under a shared row lock. Browser-supplied fees are ignored.
- Previous saved-order retries return their original result, even after a rule is
  disabled. Historical order totals and fees are not rewritten. New orders store
  the applied rule version and delivery fee.
- Public policy copy now refers to checkout rules, not an unchangeable ₹799 promise.

## Verification
13 exported-schema/PGlite + actual-handler checks passed, including authorization,
RLS, thresholds, coupon interplay, missing/disabled/deleted rules, stale edits,
forged fees, audit actor spoofing and saved retries. Static QA passed.
Browser runtime could not be installed in this environment; Docker unavailable.
Real local browser/Auth acceptance remains pending. New admin account flow uses
the existing operations-admin identity; no extra user roles were introduced.

## Laptop acceptance (same existing project root)
Stop an old foreground function server with Ctrl+C before extracting the ZIP.
Keep Docker Desktop running. This setup preserves local orders and credentials,
applies the additive local migration, and configures explicitly synthetic zero-fee
QA rules. It does not configure any production delivery fee.

Window 1:
```bash
bash scripts/start_local_delivery_qa.sh
```
Leave serving. Window 2 in the same project folder:
```bash
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```
Expect 38 checkout/API checks then 64 admin-delivery/operations checks and exit 0.
The admin-delivery tests save a synthetic ₹40/₹799 rule, verify audit/deletion and
recreate zero-fee fixtures. Never apply those QA fixture fees to production.
If a check fails, share its error and relevant function log without credentials.

## Production gate (NOT executed)
Review migration history and back up first. Deploy database migration and both
changed functions with JWT verification, then matching static assets as a coordinated
release. Configure actual normal/bulk fees through admin; missing rules deliberately
block new checkout. Smoke test with user approval. Payment gateway remains last
before final financial acceptance and explicit production approval.
Do not roll back only the database or only the pricing handler: the old release
assumes zero fees. Stop new ordering and plan coordinated rollback; keep historical
orders and audit records. This development update is not production-approved.

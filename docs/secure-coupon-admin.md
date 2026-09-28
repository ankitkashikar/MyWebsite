# Secure coupon management — development handoff, 24 September 2026

Continues the accepted delivery-settings work (user reported 38 checkout checks
and 64 operations checks; operations exit 0). Branch: tcb-secure-coupon-admin.
No production push, merge, migration or deployment was performed.

## Implemented
Admin page alongside Delivery Settings: create/edit, enable/disable, delete,
paginated listing and latest 50 audit events with before/after values and actor.
Fields: immutable coupon code, percentage or flat discount, food subtotal minimum,
normal/bulk/both scope, optional discount cap, overall and per-phone usage limits.
Existing date, product and category restrictions are preserved and shown read-only;
this UI does not create or edit those advanced restrictions.

Auth is checked by admin-orders using the existing verified TCB_ADMIN_EMAIL
identity. No browser-provided audit actor is trusted. Database mutation and audit
insertion are atomic, versioned edits reject stale requests, and direct public
reads/writes/RPC calls remain denied. No real promotion is seeded.

Deletion archives the code and disables redemption. It cannot be reused, so usage
history cannot be reset. Existing orders, monetary values, and saved retries remain
intact. Customer validation checks the deletion marker as well as active status.

## Validation
13 database/actual-handler checks passed before the session interruption using
PGlite and the exported schema. Covered create/edit, percent/flat pricing, caps,
minimum, scope, restrictions preservation, disabled/deleted coupons, usage limits,
historical orders/retries, RLS, unauthorized API actions, verified audit actor,
invalid amounts and stale edits. Fresh syntax checks and static QA passed after
continuation. Browser/Docker verification remains pending; runtime downloads were
unavailable and Docker is not installed in this environment.

## Laptop run — existing project, no database reset
Extract the update ZIP over:
D:\Personal Projects\TCB-local-supabase-qa\MyWebsite-local-supabase-qa

Stop the prior foreground function server with Ctrl+C first. Keep Docker running.
Window 1:
```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/start_local_delivery_qa.sh
```
This installs dependencies, synchronizes local functions, prepares a synthetic
operations account, applies the additive coupon migration locally, restores
synthetic zero-fee delivery fixtures, refreshes the API schema cache, and serves
with the correct environment. It preserves existing local orders.

Leave Window 1 serving. Window 2:
```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```
Expected: 38 checkout/API checks followed by 78 coupon/delivery/operations checks,
exit 0. Added 14 checks: anonymous/non-admin rejection and six browser CRUD/audit
checks per viewport (390 and 1280). The suite creates synthetic coupon codes only.
Share PASS/FAIL and exit code, not credentials.

## Release boundary
New migration: supabase/migrations/20260923000200_coupon_admin.sql, after delivery
settings migration. Coordinate migration and admin-orders/static deployment only
after explicit production approval and migration reconciliation. Coupon soft-delete
logic must remain in place during any rollback; do not resurrect archived codes.
Payment gateway integration remains last before final acceptance and approval.
Next immediate step: execute this laptop acceptance suite.

> Update: deployed definitions have now been compared and local filenames reconciled. See `migration-history-reconciliation.md`. Earlier unresolved-history findings below are retained as review history.

# Database upgrade review — 24 September 2026

Status: offline rehearsal passed; production unchanged. This is a candidate upgrade path, not production release authorization.

## Findings

- The unmodified 20 September website public-schema export already contains operations/security changes. Repository migrations do not form a blank-database bootstrap: the early files require pre-existing tables.
- Master context records deployed versions `20260917085405` (order_operations) and `20260917085433` (security_hardening), while repository filenames are `20260916_order_operations.sql` and `20260917_security_hardening.sql`. The live migration ledger has NOT been inspected. Do not blindly run `supabase db push`, rename historical files, or repair migration history based on this document.
- Local QA imports the export as a synthetic baseline; some preparation scripts apply SQL directly. Passing local QA does not establish the production migration ledger.
- The exported default privileges grant service_role broad access to newly created tables. The delivery/coupon audit migrations granted SELECT/INSERT without removing those inherited privileges. The new additive `20260924000100_audit_grants.sql` removes service_role UPDATE/DELETE/TRUNCATE and other table privileges, retaining SELECT/INSERT. Existing historical migrations remain unchanged. Database owners still control the database; this does not make history immutable to its owner.
- The older `schema_compatibility_qa.mjs` covers a previous two-migration stage. Use the new full-chain rehearsal for this upgrade; it does not replace browser/API acceptance.

## Exact upgrade order from this exported baseline

1. `20260920000100_coupon_validation.sql`
2. `20260920000200_atomic_orders.sql`
3. `20260923000100_delivery_settings.sql`
4. `20260923000200_coupon_admin.sql`
5. `20260924000100_audit_grants.sql`

Files 1–4 are unchanged and must run once, in order, against a matching baseline. They are not generally re-runnable. File 5 is a re-runnable grant correction. A database already containing some changes needs schema AND ledger comparison before selecting remaining migrations. Do not use table existence alone to certify an upgrade.

The test report includes SHA256 hashes of the baseline and every migration. No production delivery fees or coupons are seeded by these migrations. Missing delivery settings continue to block new checkout.

## Repeat the offline rehearsal

Extract the update ZIP into the existing local QA project, retaining folder structure. Node 24 and npm are required; npm downloads the pinned PGlite test dependency. No Supabase credentials, Docker, or database connection are used. The database lives only in memory and is discarded.

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_migration_upgrade_qa.sh
echo "Exit code: $?"
```

Expected: **22 migration upgrade checks passed**, exit code 0. Tested here with Node 24.19.0 and PGlite 0.5.8.

Coverage: each of five migrations applies; injected SQL failure rolls its DDL back; every original synthetic customer/order/item/status-event field survives; coupon restrictions and saved retry responses survive; missing delivery rules fail closed for both types; anonymous/authenticated RPC and table access is denied; service role retains RPC access and append/read audit access but cannot delete/update history.

Limits: the rollback check compares relation/column state, not every catalog object. No actual production data, ledger, concurrent locks, PostgREST schema cache, backup restore, or deployment was tested here. Existing 38 checkout and 78 operations checks were reported passing before this patch; they must be rerun locally with the grant correction. Local preparation scripts now include it for fresh and existing local QA setups.

## Later deployment gates — no commands executed remotely

1. Collect a fresh schema-only export and read-only migration ledger for the website project `ncbyfovvetvmkrlzapku`. Compare IDs, function definitions, grants, policies, triggers and constraints with the rehearsal baseline. Keep customer/order data and secrets out of shared evidence. Stop on drift and rehearse the actual upgrade against that baseline before choosing a migration-history reconciliation.
2. Rehearse backup restoration and the selected upgrade on a disposable PostgreSQL/Supabase instance. Verify existing orders, item counts, totals, payment/status fields, coupon restrictions and retry responses, plus 38 checkout and 78 admin/operations checks. Record the restored backup and test results.
3. Prepare matching database, Edge Function and static frontend versions together. The delivery migration changes checkout requirements; do not assume old checkout can stay live through the change. Plan a controlled checkout pause while coordinating the rollout. Delivery settings remain unconfigured until the owner sets real rules through authenticated admin.
4. After remaining development, finish the deferred content/catalogue review before UPI/payment integration and final acceptance. Seek explicit production release approval only with the reconciled ledger, exact files, backup/restore evidence and rollout plan ready.
5. During an approved release, stop at any failed migration. Each file commits independently; a later failure does not undo earlier files. Inspect the actual ledger/schema before resuming. Do not delete history or replay the whole chain. Prefer a reviewed forward correction; a restore requires a tested backup and an explicit plan for any writes since that backup. Rolling back static files alone is not a database rollback.

Next: repeat the packaged rehearsal on Windows, then rerun local delivery acceptance with the grant correction. Production ledger reconciliation is still a release blocker.

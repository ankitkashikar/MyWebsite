> Current status: owner reported all 12 Docker recovery checks passed, exit 0.
> The current rehearsal includes the Customers migration (six pending migrations).
> Historical pending/next-feature statements below are superseded. For production
> boundaries and outstanding evidence, see production-recovery-procedure.md.

# Local backup restoration and upgrade recovery

Production is untouched. No production credentials or connection strings are accepted by this rehearsal. It uses the verified website schema export and synthetic customer/orders. The one-coupon-per-order rule remains unchanged.

## Run on Windows

Start Docker Desktop, extract this update into the existing QA project, and run in Git Bash:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_backup_recovery_qa.sh
echo "Exit code: $?"
```

Requires Node 24 and Docker. The first run downloads postgres:17 if needed. Expected: **12 docker backup/restore and upgrade-recovery checks passed**, exit code 0. This Docker run is pending on the user's laptop; it has not been executed in the development workspace, where Docker is unavailable.

The script creates one uniquely named disposable PostgreSQL 17 container without network access or published ports. It uses Docker exec to communicate and separate fresh databases for restores. It does not touch existing local Supabase containers. Normal completion or caught failures remove its container. A forced process termination may leave its uniquely named tcb-recovery-* container for inspection; never remove unrelated containers.

Custom-format pg_dump backups are copied to `.recovery-qa/<unique-id>/`. pg_restore uses exit-on-error and a single transaction. Baseline, partial-upgrade and completed-upgrade backups plus result.txt remain for inspection; these contain synthetic rows only. The directory is ignored by Git. Each backup's SHA256 is printed in the run output.

## Verified here

The same SQL recovery scenarios passed all **12 PGlite checks** using PGlite 0.5.8. That mode exports a data-directory archive to disk and loads it into a fresh PGlite instance. It is not a pg_dump/pg_restore substitute and does not prove Docker or hosted Supabase recovery. Reproduce after installing the prior pinned migration-test dependency:

```bash
node scripts/backup_recovery_qa.mjs --pglite
```

Checks cover baseline restore, a partially upgraded backup, transactional migration failure, resume of only remaining migrations, legacy data preservation, upgraded backup restore, stable saved retries, fail-closed delivery configuration, audit permissions, combined-coupon rejection and recovery of the pre-upgrade snapshot. Comparisons cover stored rows, column definitions, constraints, function definitions/ACLs, table grants, RLS flags/policies, sequences and a synthetic migration ledger. Physical recovery can advance sequence reservations; the check permits gaps but rejects sequence regression.

## Boundaries

- Migration history is a synthetic version/name table; migration SQL and ledger insertion run in the same test transaction. This is not a rehearsal of Supabase CLI's own migration orchestration.
- PostgreSQL restores use fresh databases in the same disposable cluster, so roles already exist. Cross-cluster role/bootstrap restoration is not covered.
- No hosted Supabase Auth users, storage objects, Edge Function deployment, secrets, external payments, actual production data or writes during backup are included.
- Restoring the old snapshot discards changes made after it. This is acceptable for this synthetic rehearsal, not an automatic production rollback policy. Production recovery needs its own approved backup, role/configuration restoration, write handling and validation plan.
- Historical migrations are not replayed; the exported baseline already includes them. Only the five pending migrations are applied.

## Next feature: Customers

After the Docker recovery result passes, develop a separate Customers section in admin.html using backend-authorized read-only queries:

- Search customers by phone/name and show recorded addresses from their website orders.
- Show normal, bulk and combined website order counts, with order status visible and cancelled/rejected counts distinguished.
- Open order history with timestamps, items and quantities.
- Show favourite items by quantity, with the counting rule labelled; exclude cancelled/rejected orders from preference summaries.
- Show common order hours in Asia/Kolkata, with counts and explicit empty states for customers with little/no history.
- Paginate customer/order lists; reveal customer data only after server-side admin authorization. Do not expose a public customer-directory API or trust frontend hiding for access control.

Existing Coupons section already supports create/edit/enable/disable/delete and audit history. It is part of the tested local build and awaits coordinated deployment; no duplicate coupon screen is needed. Keep single-coupon enforcement for normal and bulk orders.

Development order remains: recovery acceptance → Customers development/tests → final public content/catalogue review → UPI/payment work → final release acceptance and explicit production approval.

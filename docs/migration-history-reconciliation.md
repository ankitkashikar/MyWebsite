# Migration history reconciliation

The uploaded production migration-list.txt records versions 20260917085405 and 20260917085433. The uploaded Pasted text.txt contains their names and stored statements. Both stored SQL definitions match the repository SQL token-for-token after removing comments and formatting whitespace; quoted string values and operators match. Markdown escaped pipes and serialized newlines were decoded before comparison, and the complete line diffs were reviewed.

Local filenames have been corrected, preserving the original SQL contents:

| Previous filename | Correct filename |
| --- | --- |
| 20260916_order_operations.sql | 20260917085405_order_operations.sql |
| 20260917_security_hardening.sql | 20260917085433_security_hardening.sql |

No production migration repair, SQL execution, merge, push or deployment was performed. No remote history alteration is needed for this mismatch. The fresh public-schema export matches the tested baseline byte-for-byte (SHA256 d414c42f7ffcf433a3a2e188b094178e58509a1df4a1de95db5ccbe9dc96bea0).

Pending migrations remain, in order: 20260920000100, 20260920000200, 20260923000100, 20260923000200, 20260924000100. Matching this recorded history does not establish a blank-database bootstrap or complete production acceptance.

## Apply the filename correction on Windows

Extract this package into the existing QA project. Run:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
node scripts/reconcile_migration_filenames.mjs
echo "Exit code: $?"
```

The script validates both old/new file contents against known hashes before changing either. It renames old files or removes an identical old duplicate when the new name already exists. Modified files cause a stop for review. Re-running is safe. It touches only the two root supabase/migrations files, not the disposable .local-supabase-qa database/history.

Verification: SQL token comparison passed for both recorded definitions; filename installer passed old-file, duplicate-file, modified-file rejection and already-reconciled cases; security_step1a_qa.py passed. The previously run 22 migration tests remain applicable because no SQL content changed.

Coupon rule: only one coupon per normal or bulk order; discounts must not stack. Existing server validation rejected ten array/object/combined-code cases without customer/order writes during the prior review.

Next development step: prepare and test backup/restore plus upgrade recovery on a disposable local PostgreSQL/Supabase database. Production release still requires that evidence, coordinated frontend/function/database rollout, real admin-configured delivery rules, deferred public-content review, payment completion and explicit release approval. Do not run db push as part of this filename correction.

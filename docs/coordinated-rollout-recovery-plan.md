# P20 — coordinated rollout and recovery plan

Prepared 26 September 2026. **Plan only; not permission to deploy.** Applies solely to website Supabase project `ncbyfovvetvmkrlzapku` and `ankitkashikar/MyWebsite`. No production request/write, push, merge or deployment occurred in this work.

## Repository fixes prepared

- `webpack.yml` now truthfully runs Selected Offline Regression on main PRs, main/current work-branch pushes and manual invocation. Node 24, isolated pinned PGlite/Linkedom dependencies, read-only repository permissions; no publication or production calls. The existing misleading echo-only deploy job is gone.
- Two unused npm publishing workflows now have manual-only disabled notices, no release trigger, publish command or publishing secrets/permissions.
- Live endpoint smoke is manual-only with confirm_live default false. The script itself refuses execution without --confirm-live. Confirming a UI checkbox is not a substitute for owner authorization.
- Smoke checks validate the exact safe error shape and UUID support reference and reject extra fields/changed messages. Unexpected response bodies are not printed.
- Six offline smoke-contract tests and four YAML structure checks passed, plus the existing source predeploy check. No GitHub Actions run has occurred; offline suite results from P18 remain the application evidence.

The workflow changes apply only after a future approved repository update. GitHub branch protection/required checks must be configured separately; workflow files cannot prove that protection exists. Actual Pages hosting remains unmodified and unverified.

## Gate A — identify and freeze the release candidate

Before requesting production approval:

1. Finish owner-selected non-held work and resolve P4–P7 facts/links/policies. Revisit held menu/images/prices/payments with the owner; do not silently resume them.
2. Resolve the UPI placeholder and complete approved real payment requirements when that hold is lifted. `release_preflight.py` must pass then; it intentionally fails today. Test business delivery/coupon settings without substituting QA values.
3. Record a candidate Git commit and file hashes. Record the deployed frontend commit, each deployed function version/source, server configuration names and migration/schema evidence. Preserve last-known-good artifacts securely; never put secret values into the manifest/repository.
4. Confirm actual Pages publishing mechanism and whether merging main immediately publishes. If main is the Pages source, do not merge the frontend early. A green offline workflow is not a deployment.
5. Run final release-candidate regression, including local Supabase acceptance and required real-device/manual checks. Current 38 checkout /85 admin results and 12 offline suites are prior evidence, not automatic acceptance of future changes.
6. Present the exact candidate, account evidence, remaining risks, backup/recovery evidence, write-pause method and deployment sequence for explicit owner approval (P23).

## Gate B — recoverability and write control

Release cannot start until these items are filled in and verified:

| Required record | Current state |
| --- | --- |
| Release operator and incident decision-maker | Unassigned |
| Scheduled window in Asia/Kolkata | Unscheduled |
| Maximum acceptable data loss and downtime | Owner decision pending; no values invented |
| Production backup identifier/time and protected location | Not verified |
| Recovery access, procedure, privileges and measured restoration time | Production evidence pending |
| Auth users/config, secrets, function revisions and storage recovery scope | Not covered by synthetic database recovery |
| Method to stop new order writes and relevant admin mutations | Not implemented/verified as a coordinated release control |
| In-flight request draining and old browser tabs | Procedure/verification pending |
| Orders and mutations after backup | Preservation/reconciliation procedure required |

A frontend maintenance message alone cannot stop API clients or cached tabs. Do not assume disabling a delivery rule blocks every replay/admin write, or that deleting a function is a suitable pause. Prepare and test the specific approved control before release. Take the final backup only after the agreed write boundary is established, or document how later writes are preserved.

The owner reported 12 synthetic Docker restoration/recovery checks passed. Those cover disposable databases, not full hosted Supabase recovery or writes arriving during production backup. Do not restore a stale snapshot over newer customer orders without an approved reconciliation plan.

## Gate C — approved deployment sequence (not executed)

1. Verify website project reference, approved candidate and recovery artifacts; establish the approved write pause and record any in-flight requests.
2. Refresh read-only migration history/schema and compare to the reviewed baseline. Stop on drift or unknown migrations. The supplied snapshot had historical versions 20260917085405 and 20260917085433; do not replay them or repair history to force a match.
3. Apply only confirmed missing migrations in this order:
   - 20260920000100_coupon_validation.sql
   - 20260920000200_atomic_orders.sql
   - 20260923000100_delivery_settings.sql
   - 20260923000200_coupon_admin.sql
   - 20260924000100_audit_grants.sql
   - 20260925000100_admin_customers.sql
   Verify each schema/privilege result and actual migration ledger before continuing. Synthetic ledger testing is not proof of CLI rollback semantics. Do not blindly rerun partially applied SQL.
4. Deploy matching place-order, validate-coupon, admin-orders and order-status revisions with the reviewed JWT flags and origin. Confirm required server configuration exists without exposing values. Validate RPC availability/schema cache before releasing traffic.
5. Publish matching frontend/assets through the confirmed Pages method. Include admin Customers/coupon/delivery components, kitchen alerts, supabase-config.js and status-page assets; do not copy only checkout HTML. Exclude local QA directories, scripts, credentials and synthetic seeds from the publication artifact where the hosting process allows artifact selection.
6. Authorized admin configures approved production delivery rules and offers after price holds are resolved. Missing delivery rules intentionally block checkout. Do not run prepare_local_* scripts in production.
7. With explicit authorization for live probes, run public-page and endpoint smoke checks, then controlled business acceptance. The live endpoint script needs --confirm-live and consumes limiter state. These two probes alone do not cover checkout, coupon, admin CRUD or payment correctness.
8. Verify authentication denials, safe tracking responses, normal/bulk order creation/replay, server totals, single coupon, status/audit flow and customer privacy under the approved live acceptance plan. Never mark a real unpaid order paid simply to get a test pass.
9. Resume writes only after the release operator records acceptance. Watch failure-reference logs and kitchen attention state during the agreed observation window. Record deployed versions and final evidence.

## Failure and recovery decisions

| Failure point | Action |
| --- | --- |
| Source/schema/config drift before writes | Stop release, keep current production running, resolve plan and repeat affected checks |
| Migration failure | Keep approved write pause; inspect actual schema and ledger. Prefer a reviewed forward repair. Do not assume all migrations rolled back |
| Function/RPC mismatch | Keep writes paused; deploy corrected matching revision or a specifically verified compatible prior set |
| Frontend failure | Restore the prior frontend only if it is compatible with the deployed API/schema; otherwise keep writes paused and fix forward |
| Data integrity concern | Preserve logs/backups and post-backup changes; incident owner chooses a verified restoration/reconciliation procedure |
| Validation failure after reopening | Re-establish the approved write pause, capture new writes, and reassess recovery. Avoid repeated blind deployment or payment retries |

Do not auto-drop new tables/columns or erase migration ledger entries. Additive-looking migrations may still replace functions and privileges; rolling back just HTML is not a database rollback. After any restoration verify order/customer/item consistency, idempotency, audit continuity, sequence safety, access controls, configuration and Auth before reopening.

## Next — P21 production recovery evidence

Confirm the actual website backup/recovery capability, responsible operator, recovery scope and acceptable loss/downtime using read-only evidence. Then prepare the missing write-control/reconciliation procedure. P20 rollout remains pending; no production execution is authorized by this document.

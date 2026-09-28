# P19 — production configuration readiness

Reviewed 26 September 2026. **Preparation complete; production readiness is NOT approved.** This review inspected repository files and previously supplied migration evidence. No production dashboard, live endpoint, remote schema, secret or account setting was accessed or changed. No push, merge, migration, deployment or production smoke test was run.

This checklist supersedes conflicting deployment instructions in older documents. Preserve the historical evidence; do not replay old setup steps automatically.

## 1. Source settings verified

| Setting | Repository value / finding | Live confirmation |
| --- | --- | --- |
| Website Supabase project | `ncbyfovvetvmkrlzapku` / `https://ncbyfovvetvmkrlzapku.supabase.co` | Pending account-level check |
| Browser API credential | JWT payload declares `anon` and this website project; no signature/live validity verification in this review | Confirm active public key; never supply service-role credentials to browser |
| CORS | All four functions use `https://ankitkashikar.github.io` | Confirm deployed versions; `/MyWebsite` is a path, not part of the origin |
| place-order | `verify_jwt = true`; server pricing, idempotency and rate limiting | Confirm deployment matches source |
| validate-coupon | `verify_jwt = true`; server coupon validation and rate limiting | Confirm deployment matches source |
| admin-orders | `verify_jwt = true`; handler verifies user JWT and configured email | Confirm account and deployed configuration |
| order-status | `verify_jwt = false`; order number + phone checks and rate limiting | Intentional public lookup; do not remove handler protections |
| Sensitive responses | Four functions set `Cache-Control: no-store` | Verify after approved deployment |
| Delivery settings | Missing/disabled rules block new checkout; no production business fees supplied here | Owner setup held with prices |
| Coupons | Admin-managed, audited, one per order | Actual offers held; do not seed QA coupons in production |
| Customer progress | Accepted → Preparing → Food is Ready → Dispatched | No external messaging, rider tracking or ETA project added |

CORS is a browser boundary, not admin authorization. Keep JWT/user/email verification and database privileges intact.

## 2. Server configuration and account checklist — READ ONLY now

Use the existing website project. Do not open or modify dashboard/inventory projects for this work.

- [ ] Confirm project name and reference match the website project before any future action.
- [ ] Confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are available to the functions that reference them. Record availability only, not values. Do not rotate or replace credentials as part of this review.
- [ ] Confirm `TCB_ADMIN_EMAIL` is configured and matches the intended existing Supabase Auth user. Code trims and lowercases the email and validates the signed-in user through Auth.
- [ ] Confirm that account can access both `/MyWebsite/admin.html` and `/MyWebsite/orders.html`. The current code uses the same authorized identity; there are no separate cashier/manager permission tiers. Do not create another shared account from the obsolete guide.
- [ ] Confirm unauthorized identities remain denied. Record Auth/session security settings for review; do not weaken them to resolve a login issue.
- [ ] Confirm the deployed four-function JWT flags match the table above. The local TOML alone does not prove live flags.
- [ ] Confirm database RLS/grants and RPC privileges against the reviewed schema. No permissive browser table policies should be added to bypass function failures.
- [ ] Confirm production backups/recovery access, retention and restoration responsibilities. The 12 synthetic Docker checks do not verify hosted Auth/storage/secrets or current production recovery.
- [ ] Name the staff member responsible for function-log review, review frequency and incident response; confirm log access and retention. P17 added manual diagnostics, not automatic outage paging.

Safe evidence: project reference, setting names and configured/not-configured status, function versions/JWT flags, redacted account settings, backup dates/retention and responsible person. Never paste passwords, tokens, service keys, customer records, unredacted environment output or raw network exports.

## 3. GitHub Pages and workflow readiness

- [ ] In repository Settings → Pages, record the existing publishing method, source branch/folder if applicable, and published URL. Inspect only; do not save changes now.
- [ ] Record the latest actual Pages deployment status and commit. A green workflow named “Deploy Static Website” does not establish deployment: `.github/workflows/webpack.yml` only runs an echo command.
- [ ] Confirm publishing preserves the `/MyWebsite/` base path and verify both extensionless URLs and explicit `.html` URLs at release smoke-test time. Do not assume `/admin` behavior from local tests.
- [ ] Inspect branch protection, required checks and deployment permissions. Confirm which action would publish before approving a future merge to main.
- [ ] Reconcile CI with the selected regression runner. Existing workflows include historical branch/path filters; `selected_regression_qa.mjs` is not wired into Actions yet. Do not claim all offline suites automatically gate a PR.
- [ ] Review two unrelated package-publishing workflows triggered by a created release. They run npm ci/test/publish despite no root package.json in this checkout. Do not add an npm token or create a release to test them. Cleanup/gating needs a reviewed repository change before release.
- [ ] Update the old live endpoint smoke assertion before using it with P17: `security_step2_live_smoke.py` compares the admin error string exactly, but support references now add a suffix. Validate the UUID separately and preserve the safe-message assertion.

Do not run the live endpoint smoke during this no-production-change review: even failed public lookups consume database rate-limit state. Public-site GET verification is separate from function/schema validation and has not been performed here.

## 4. Database/function/frontend alignment

Previously supplied production history records `20260917085405` and `20260917085433`. Their local filenames were reconciled without database changes. Against that supplied snapshot, the six pending migrations are:

1. `20260920000100_coupon_validation.sql`
2. `20260920000200_atomic_orders.sql`
3. `20260923000100_delivery_settings.sql`
4. `20260923000200_coupon_admin.sql`
5. `20260924000100_audit_grants.sql`
6. `20260925000100_admin_customers.sql`

- [ ] Refresh read-only migration/schema evidence near release and check for changes since the supplied snapshot. Do not infer current remote history from filenames.
- [ ] Prepare one coordinated release manifest covering these migrations, all four functions and matching frontend files. Do not publish the new frontend against missing RPCs/configuration.
- [ ] Exclude local QA folders, synthetic account/rule/coupon setup and test secrets from deployment.
- [ ] Prepare controlled rollout and recovery steps before asking for release approval; address in-flight orders and post-backup writes rather than blindly restoring an old snapshot.

No migration push/repair commands are included because this checklist does not authorize applying anything.

## 5. Held work and evidence

Menu/catalogue, images, business prices/offers and payments remain on hold. `yourbusiness@upi` remains in both checkout pages. `release_preflight.py` correctly exits 1 and blocks release. Do not guess a recipient or replace it merely to satisfy the guard. Final business details/links/policies (P4–P7) also remain tracked.

Checks performed here:
- Existing Step 2 predeploy source check: PASS.
- Four-function source configuration checks: PASS (JWT flags, origin, no-store, limiter, server credential references).
- Browser public JWT claims: expected project and anon role; not proof of signature or live validity.
- Migration inventory: eight files, including the two recorded historical and six pending versions.
- Payment release preflight: expected BLOCKED result, unchanged hold.

Latest accepted local evidence remains 85 admin/operations checks after P17, and 12/12 selected offline suites after P18. These do not establish production readiness.

**Next — P20 preparation:** turn the deployment/CI gaps above into a concrete coordinated rollout and recovery plan, with proposed repository fixes. Do not execute a rollout. Account evidence and held work remain gates before P23 approval.

## P20 preparation update — 26 September
The repository workflow and smoke-assertion gaps above are now fixed locally; see coordinated-rollout-recovery-plan.md. The misleading deployment job became selected offline regression, npm publishing is disabled, and live probes are manual/explicit. These changes are not pushed or active on GitHub. Actual Pages configuration, branch protection, account evidence and production recovery remain unverified.

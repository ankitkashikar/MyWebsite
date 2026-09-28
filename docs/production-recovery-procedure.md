# P21 — production recovery, write pause and order reconciliation

Prepared 28 September 2026. Website project only: `ncbyfovvetvmkrlzapku`.
**Status: procedure prepared; production arrangements unconfirmed; no production action authorized.**

## Evidence available

- Owner reported 12 Docker backup/restore and upgrade-recovery checks passed with synthetic data, exit 0.
- Supplied public-schema export and recorded migration history supported the local compatibility review. A schema-only export cannot recover customer/order data.
- No connected Supabase management tool is available in this session. No live backup list, recovery entitlement, retention, restore rights or operator access has been verified.
- No production export, restore, write pause, migration, deployment or live probe was performed for P21.

The local rehearsal does not verify hosted Auth, Storage files, secrets, project settings, replication or writes during backup. Keep those limits even though the local test passed.

## Read-only evidence to collect

In the Supabase dashboard, select the WEBSITE project and confirm its reference. Open Database → Backups. Record the current plan and what the page actually offers, latest successful backup timestamp with timezone, retained dates/recovery window and any warnings. If PITR exists, record its earliest/latest recoverable points. Do not click restore, upgrade or enable anything.

Record who has restore access without attempting a restore. Confirm whether Storage buckets are used (yes/no/unknown, no file contents needed). Record whether a separately held backup exists and when it was last restored in isolation. Do not upload production dumps, passwords, access tokens, connection strings, keys or customer rows to this conversation. A cropped/redacted screenshot and the non-secret fields in production-recovery-evidence.md are sufficient for the initial review.

Provider documentation checked 28 September 2026:
https://supabase.com/docs/guides/platform/backups
Supabase documents daily backups for paid tiers and recommends regular off-site CLI exports for free-tier projects. Database backups omit Storage object bytes. This is provider guidance, not proof of this project's plan or backup health. No upgrade or paid service is selected here.

## Recovery scope to verify before release

| Asset | Evidence needed |
| --- | --- |
| Database data/schema | Restorable backup, timestamp, consistent scope, checksum for downloadable files, isolated restore result |
| Business records | Both order/item channels, customers, request/idempotency records where deployed, coupons/redemptions, delivery rules, audit history and catalogue referenced by saved orders |
| Auth and database roles | Confirm coverage of chosen backup/restore method; roles, grants, RLS, login recovery and credentials managed separately as needed |
| Storage | Object bytes plus matching metadata/config if used; database-only backup is insufficient |
| Functions/frontend | Known-good deployed revisions and verified compatibility with restored schema |
| Server configuration | Names, protected recovery location and authorized custodian; no secret values in Git or this document |
| External effects | Staff fulfilment actions and, when resumed, verified payment/refund records; restoring a DB cannot reverse those effects |

The customer/operations identifiers and table inventory must be verified against the live schema at the time of release. New local migrations are not assumed to exist remotely.

## Write-pause procedure — specification, not an installed switch

The repository currently has no verified release-wide write-pause control. Until one is implemented and rehearsed, this procedure cannot be executed safely merely by following a checklist. Do not substitute a frontend banner, disabled delivery rule, changed password or deleted function.

### Required behavior of the future control

1. Authorized release operator closes admission for new checkout writes and all staff mutations: payment confirmation, order status/acknowledgment/delivery edits, coupon changes and delivery-setting changes. Catalogue/customer edits, scheduled jobs, direct database clients and any other writers must also be inventoried and stopped or covered. Public/customer read requests may still write limiter state; decide whether to pause them or explicitly exclude that transient state from reconciliation.
2. Show a temporary-unavailability message and preserve carts/request keys. Do not automatically resubmit checkout or ask for another payment. Existing saved responses must not be confused with new order acceptance; choose and test replay behavior explicitly.
3. Requests already admitted drain completely, including audit inserts after an order update. A database lock that covers only one statement is not proof that a whole multi-statement request finished. Record active request/transaction evidence, job state and connection owners; never infer completion from an arbitrary sleep alone.
4. Use a tested database-level business-write fence or equivalent control that closes the gap between checking maintenance state and committing a write. An Edge Function environment flag alone is insufficient for in-flight/direct writers. The fence must cover all identified business writers and have a protected migration/recovery path; it must not create a public bypass.
5. Validate the control on disposable local infrastructure: normal/bulk new orders blocked, staff writes blocked, already-admitted operations handled consistently, direct write bypass denied, audit consistency preserved and reopen/retry safe. These tests have NOT been implemented or passed in P21.

### Operator sequence once the control exists and release is approved

- Assign one operator and one recovery decision-maker. Record candidate revisions, approved downtime/data-loss limits and protected evidence destination.
- Record pause-request time in UTC and Asia/Kolkata. Ask staff to stop console edits and keep the current order queue available for fulfilment reference.
- Close admission, stop other writers, drain admitted work, then establish and verify the business-write fence. If any writer is unaccounted for, stop the rollout.
- Mark a verified quiescent boundary B. Capture a consistent final business snapshot/backup, migration ledger, sequences and protected record manifest at B. Backups taken before B need a separately verified method of preserving changes through B.
- Carry out the separately approved migration/function/frontend plan while business writes remain fenced. Record every operator change; keep business configuration changes distinguishable from customer/staff activity.
- On success, complete acceptance before reopening. On failure, preserve the failed state where possible, compare recovery choices, and obtain the required incident decision before any destructive restoration.
- Reopen through the same protected control only after reconciliation and verification are signed off. Tell staff which queue is authoritative and avoid duplicate fulfilment.

## Order reconciliation — do not treat restoration as automatic correctness

Let R be the chosen recovery point and B the verified pause boundary. Preserve the state at B and any subsequent controlled changes before restoring. If the failed system cannot supply a complete delta, do not claim zero loss; escalate to the owner using the approved loss limit.

Perform comparison in an isolated, access-controlled recovery environment first. Production customer data stays in approved protected storage. Do not run production checkout handlers to reconstruct historical orders: current prices/coupon limits/scheduling checks may differ and could cause duplicate side effects.

| Comparison | Required handling |
| --- | --- |
| Same channel + stable order ID on both sides | Compare all stored order/item values and relevant audit history. Identical records require no rewrite |
| Order present at B but absent at R | Preserve its original identity, items, amounts, request fingerprint/response where available, customer linkage and audit trail; prepare a reviewed recovery script, not a new checkout |
| Same idempotency key maps to different orders/responses | Block reopening; investigate. Never choose the newest row automatically or mint a replacement key |
| Order number collision | Block reopening; reconcile identities and sequence state before any new orders are allowed |
| Changed status or payment fields | Compare source history and actual staff/external evidence. Do not undo a dispatched order, mark an unpaid order paid, or refund merely because a restored row differs |
| Customer/address differences | Preserve order-time contact/address snapshots. Do not overwrite older snapshots with today's customer profile |
| Deleted/disabled coupon or rule | Compare full snapshots/version/audit data, not only current rows. Do not resurrect deleted offers or apply today's rules to saved totals |
| Missing order items, broken FK, missing audit event | Treat as unresolved integrity issue; a matching total row count does not clear it |
| Missing historical request/audit data | Record the gap explicitly. Older orders may legitimately predate these features; never fabricate request fingerprints or staff actions |

Compare by full stable identifiers and canonical stored values. Timestamp-only filters and counts can miss updates, deletes, transactions spanning boundaries or records without reliable timestamps. Use consistent full snapshots, or a verified change/WAL recovery method, with counts/totals only as supporting evidence. Request fingerprints may contain personal data and belong in protected evidence, not support logs.

Before reopening verify:
- Normal/bulk counts, item quantities, stored subtotal/discount/delivery/total aggregates and row-level differences; no unexplained extra/missing rows.
- Foreign keys, channel identity, order-number uniqueness, request-key mappings, coupon usage and audit continuity. Exactly one coupon per order remains enforced.
- Sequence state cannot reuse existing IDs/order numbers; gaps alone are not corruption.
- Prior saved requests replay without creating a new order; changed requests conflict. Do these mutation-capable checks in isolated recovery rehearsal first.
- Auth/admin authorization, RLS/grants, safe customer projection, frontend/API/schema compatibility and configured delivery rules.
- Staff reconcile the fulfilment queue. Any unresolved status, payment or recovery gap blocks reopening or requires an explicit owner decision consistent with approved loss limits.

## Decisions still required

Production plan/backup evidence, recovery operator/access, approved downtime and data-loss limits, isolated production restore arrangement, Storage/Auth/config recovery coverage and write-pause implementation/rehearsal remain open. Actual payment/refund development remains held; this document does not implement it.

**Next:** obtain the read-only backup evidence and fill the companion evidence sheet. Then select a recovery method compatible with the actual project and implement/test the missing write control locally. P22 live acceptance and P23 release approval cannot be marked complete yet.

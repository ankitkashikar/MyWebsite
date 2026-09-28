# Step 5: atomic order creation and bound retries

Date: 2026-09-20. Branch: tcb-offline-pricing-audit. Offline only.

## Changes

`place-order` now creates the customer, order header, line items and completed
retry record through one PostgreSQL function call, `create_order_atomic`.
There is no compensating deletion: any SQL failure aborts the entire statement
and rolls back all of those writes, including an existing customer's name update.

The service-only `order_requests` table has a UUID primary key and stores the
normalized request plus completed response. Its unique insert and row lock
serialize callers using the same key. The transaction compares requests before
returning an existing response or doing further work. A failed transaction
leaves no incomplete reservation behind.

Meaningful identity includes order type, customer details, notes, coupon,
delivery details and consolidated/sorted product IDs and quantities. Browser
prices, totals, discounts and paid flags never define authoritative values.
JSONB equality avoids hash collisions and ignores property ordering. The
registry contains customer information and therefore has forced RLS and no
browser grants. It must not be purged casually: removing entries weakens the
retry guarantee.

- Same key + same normalized request: return the original order/total, no writes.
- Same key + changed meaningful request: generic HTTP 409, no order details.
- Normal/bulk requests share one key namespace.
- Lookup occurs before pricing, so a committed retry still works after product
  availability or coupon expiry changes.
- Legacy keys with no trustworthy request record fail closed with HTTP 409.
  Historical records, including the COD fixture, are preserved.
- The transaction locks/rechecks database products, line amounts and coupon
  rules before writing. Pricing changes between validation and persistence
  fail instead of saving stale or inconsistent values.
- Checkout retains the key for an unchanged retry and generates a new key when
  meaningful form/cart data changes. Successful checkout still resets its key.

The migration uses explicit insertion columns and typed jsonb_populate_record
conversion to preserve existing ID column types/defaults. Actual production
schema compatibility still needs pre-release verification. No schema migration
has been applied to production.

## Verification

38 new atomic-order/replay checks passed using the real SQL and handler in the
PGlite fixture. Both normal and bulk orders were covered, including:

- Matching retries and changed names, phone, address, notes, coupon, quantity,
  delivery information, or order type.
- Equivalent duplicate/reordered cart lines and ignored browser monetary fields.
- 12 overlapping identical API calls creating one order.
- Overlapping different payloads sharing a key yielding one success/one conflict.
- Second-line failure rolling back the first line, header, customer update and
  retry key; failed new customer insertion also rolled back.
- Retrying the failed key successfully once the injected failure was removed.
- Historical order preservation, expired-coupon replay and usage quota checks.
- Denied anon/authenticated access to the new registry and functions.

The 55 coupon SQL/handler checks, 98 monetary/tampering checks, existing Step 1A
security QA, static site QA and checkout JavaScript syntax checks also passed.
All 82 local browser checkout/tampering checks passed with the atomic handler.
Four local browser scenarios verified stable retry keys and changed-form key
rotation at 390px/1280px for normal/bulk checkout.

Reproduce with Node 24+ and PGlite 0.5.8:

```sh
PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/atomic_order_offline_qa.mjs
PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/coupon_offline_qa.mjs
node scripts/place_order_offline_audit.mjs
python3 scripts/security_step1a_qa.py
python3 scripts/qa_check.py
```

## Explicit remaining limit

PGlite serializes statements on one database instance. Promise.all tests prove
overlapping handler behavior, but NOT lock contention across independent
PostgreSQL connections. A local PostgreSQL installation was attempted; this
runtime rejected the installer UID/group operations. No permission bypass or
production database was used. Independent-connection concurrency acceptance
remains a release requirement, including same-key races, mismatched-key races,
coupon quota contention and rollback after an item-write failure.

The existing delivery-slot validation gap and UPI placeholder are not resolved
by this step. The UPI reminder is mandatory in docs/RELEASE_CHECKLIST.md, backed
by a conditional reminder and scripts/release_preflight.py. That preflight
correctly returns RELEASE BLOCKED while yourbusiness@upi remains in either page.
No remote push, merge, production API request or deployment was performed.

## Exactly one next step

Run independent-connection concurrency acceptance against a disposable local
PostgreSQL instance before marking duplicate/replay protection fully verified.

Follow-up: a reproducible Docker/PostgreSQL suite is now prepared in
`scripts/postgres_concurrency_qa.mjs`. It remains unexecuted because this runtime
has neither a usable PostgreSQL installation nor Docker. See
`docs/offline-postgres-concurrency.md` for commands and the precise limitations.

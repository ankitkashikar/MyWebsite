> Historical two-migration coverage. For the current full upgrade chain use `docs/migration-upgrade-review.md` and `scripts/run_migration_upgrade_qa.sh`.

# Website schema compatibility — offline checks passed

## Evidence

On 2026-09-20 the user supplied a public-schema-only export after a successful
Supabase CLI dump of TCB_Website_DB. The uploaded filename was
`ef83b835-0909-4407-8f22-edc6e4133c4c.sql`; content was inspected as SQL.
The byte-identical export is retained in
`scripts/fixtures/website-schema-20260920.sql` (no customer/order rows).
SHA-256: `d414c42f7ffcf433a3a2e188b094178e58509a1df4a1de95db5ccbe9dc96bea0`.
The export itself has no server-version or export-time header; project identity
is supported by the user's export command/transcript, not independently embedded
in the file. No production connection was made during this review.

The new runner restores this export unchanged into disposable PGlite, creates
synthetic products and a legacy COD order/item, then applies only:

1. `20260920000100_coupon_validation.sql`
2. `20260920000200_atomic_orders.sql`

Existing historical migrations are NOT reapplied. No SQL compatibility change
was needed. The earlier filename ordering/version fix remains in place.

## Results

All **24 exported-schema checks passed**, using the actual place-order handler
and migration functions with a local database adapter:

- Both migrations restore/apply without collisions.
- UUID customer/order/item defaults, unique phone upserts, foreign keys,
  mandatory fields and numeric(10,2) amounts work.
- Normal and bulk order-number triggers generate CBD/BLK numbers.
- Service-role normal/bulk orders work with and without coupons.
- Fake, expired and product-ineligible coupons fail without order writes.
- Identical retries return the original order; altered payloads conflict.
- Injected item failures roll back headers, items, retry records, existing
  customer changes and new customers for both order types.
- Every preexisting field of a synthetic legacy COD row remains unchanged
  after migration and a rejected retry; its item remains present.
- Service-role payment/status updates and status-event inserts succeed.
- Browser roles cannot read the 11 sensitive tables or execute the three new
  RPCs, despite the exported permissive default grants.

The existing **38 atomic-order checks and 55 coupon checks** also passed after
adding the optional exported-schema setup to the shared test runtime.
An initial new-test expectation incorrectly rounded the total to 360; corrected
expectation is 359.99 (399.98 less a floored 39.99 discount). Application SQL
was unchanged.

## Run again

Requires Node supporting stripTypeScriptTypes and @electric-sql/pglite:

```sh
PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node scripts/schema_compatibility_qa.mjs
```

The runner uses the checked-in schema export and synthetic rows only. It has no
production database URL or credentials. The shared adapter mocks rate limiting
and replaces the Supabase client; this is not HTTP/PostgREST acceptance.

## Limits and release work

PGlite is a serialized embedded PostgreSQL engine, not a full local Supabase
stack. Roles were locally created; service_role BYPASSRLS is an explicit test
assumption because db dump excludes role attributes. The user's earlier 11
independent-connection tests passed against the simplified fixture, not this
export. Live rows, actual sequence values, auth, deployed API behavior, and
migration-history reconciliation are not established by these tests.

Existing anon/authenticated sequence grants and permissive default privileges
remain visible in the export. New migrations explicitly revoke browser access
to their tables/functions; no unrelated production permissions were changed.

Local historical migration filenames differ from the production versions
recorded in the master handoff. Reconcile actual migration history before any
release; do not blindly push the entire migrations directory.

Both checkout pages still contain `yourbusiness@upi`. Verified business payment
details and payment-flow testing remain mandatory before production approval.
No payment details, remote systems, merge or deployment were changed.

Full local Supabase checkout/API acceptance subsequently passed on the user
laptop: all 18 checks and exit code 0. See local-supabase-checkout.md.
**Next step:** Verify operations sign-in, Order Console updates and customer
order-status lookup end to end locally. Production approval remains pending.

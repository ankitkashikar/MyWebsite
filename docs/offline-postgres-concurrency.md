# Independent PostgreSQL concurrency acceptance — passed on user's machine

Date: 2026-09-20. Development only; no production access.

`scripts/postgres_concurrency_qa.mjs` is an acceptance suite verified on the
user's Docker-enabled machine. It starts a disposable PostgreSQL 16 container on a
random loopback port, loads the shared test fixture and the actual coupon and
atomic-order migrations, and opens three independent database connections.
It accepts no database URL and removes its container on normal completion or
caught failure. An interrupted process may require manual container cleanup.

Eleven scenarios are defined:

- Matching retries and mismatched requests for normal and bulk orders.
- A shared retry key across normal/bulk channels.
- Global and per-phone coupon quota contention across both channels.
- Failure on the second item while another connection retries the same key,
  for both channels and both existing and new customers.

The suite checks distinct backend PIDs and uses `pg_blocking_pids` to establish
actual waits before releasing the winning transaction. Failure tests use a
test-only advisory-lock gate in a trigger to ensure the retry overlaps the
failing write. Assertions check saved headers, line counts, completed retry
records, authoritative amounts, pending payments and customer counts.
Database calls run as `service_role`; the observer creates the disposable fixture.

This verifies database transaction contention, not a full HTTP/PostgREST stack.
The existing handler and browser checks provide separate evidence. The fixture
does not establish compatibility with the live production schema.

## Run locally

Requires Node 24+, Docker with a running engine, and the `pg` Node package.
Docker needs access to the PostgreSQL 16 image on the first run.
From the repository root:

```sh
qa_deps=$(mktemp -d)
npm install --prefix "$qa_deps" --no-save pg@8
PG_MODULE="$qa_deps/node_modules/pg/lib/index.js" node scripts/postgres_concurrency_qa.mjs
```

Success requires exit code 0 and the final message reporting all 11 scenarios
passed. Keep that output as acceptance evidence. A syntax check alone is not
acceptance. No production credentials are needed.

## Evidence from this environment

- The PostgreSQL installation could not proceed: package lists were absent,
  and `apt-get update` failed on disallowed UID/group operations.
- Neither Docker nor Podman is available here. Running the new suite returned
  exit code 1: `CONCURRENCY NOT VERIFIED: spawnSync docker ENOENT`.
- JavaScript syntax validation passed.
- The fixture was extracted unchanged into `scripts/offline_order_fixture.sql`
  for reuse by both PGlite and this suite. All 38 existing atomic-order/replay
  regression checks passed after that extraction. PGlite serializes database
  operations, so those passes do not close independent-connection acceptance.

The environment failures above are historical. The user subsequently supplied
terminal evidence from PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2): three distinct
backend PIDs, all 11 scenarios passing, and exit code 0. This evidence followed
the CommonJS-compatible `Client` import fix. It establishes fixture concurrency
acceptance, not production schema compatibility.

The subsequent schema review renamed the two unshipped migration files to
`20260920000100_coupon_validation.sql` and `20260920000200_atomic_orders.sql`.
Only filenames and runner references changed; migration SQL contents did not.
The user's passing run predates these renames.

No remote database access, push, merge, deployment or payment-detail change was
made during this review.

The website schema export has now been restored and both migrations tested in
PGlite: 24 exported-schema checks passed. See `offline-schema-compatibility.md`
for evidence, limitations and the next local Supabase API acceptance step.

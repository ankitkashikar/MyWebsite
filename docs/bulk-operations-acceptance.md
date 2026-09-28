# Bulk operations and tracking — development update

Normal-order baseline: user supplied 28 PASS results and exit code 0.

Changes:
- Console requests normal and bulk orders, labels their type, displays bulk delivery schedule/event.
- Payment, status, rejection and delivery actions use each order's type. Composite action keys prevent UUID collisions across the two tables.
- Tracking recognizes exact CBD/BLK prefixes, selects the matching table/fields and retains phone matching, generic 404s, rate limits and restricted response fields.
- Local preparation refreshes both operations and tracking functions on --resume.
- No migrations, payment recipient changes, push, merge or deployment.

Verification in this workspace: 8 offline checks passed using the actual tracking
handler and exported SQL schema via PGlite; rate-limit responses are simulated.
Security static checks and JS/shell syntax passed. The UI-only browser regression
is prepared but unexecuted: Chromium is absent and its download failed (HTTP 502). Real local Supabase acceptance
requires Docker on the user's laptop; it is not claimed by offline tests.

Extract TCB-bulk-operations-update.zip directly into:
D:\Personal Projects\TCB-local-supabase-qa\MyWebsite-local-supabase-qa
Allow replacement. The ZIP excludes .local-supabase-qa, keys and database data.
Keep Docker Desktop running; run in Git Bash:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_operations_qa.sh --resume
echo "Exit code: $?"
```

Expected: 54 PASS checks and exit code 0. Share PASS/FAIL lines and exit code only.
The suite repeats 13 browser/Auth/API/database checks for two order types and two
viewports plus two authorization checks. Synthetic payments only; real UPI
transfers and production acceptance are excluded. Do not run other QA suites at
the same time because the same local ports/project are used.

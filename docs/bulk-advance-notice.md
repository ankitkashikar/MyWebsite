# Bulk advance-notice QA update

Minimum 24 elapsed hours before requested delivery. Customer wall times use
Asia/Kolkata. Exactly 24 hours is accepted by server time; less is rejected.
No automatic capacity guarantee; acceptance still depends on kitchen capacity.

Extract this ZIP into your existing MyWebsite-local-supabase-qa project root,
allow replacement, keep Docker running. Do not recreate the local database.

Run:
```bash
bash scripts/run_local_supabase_qa.sh --resume
echo "Exit code: $?"
```
Expected 38 passes, exit 0. Then:
```bash
bash scripts/run_local_operations_qa.sh --resume
echo "Exit code: $?"
```
Expected 54 passes, exit 0. Share PASS/FAIL and exit codes only.

Offline: node scripts/bulk_scheduling_qa.mjs (Node with stripTypeScriptTypes).
This update does not deploy production or implement payment gateway changes.

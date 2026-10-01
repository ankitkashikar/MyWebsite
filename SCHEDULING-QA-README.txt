TCB scheduling acceptance update — development only

Extract the contents directly into:
D:\Personal Projects\TCB-local-supabase-qa\MyWebsite-local-supabase-qa
Allow replacement of included source/test files. No credentials or local DB are included.
Keep Docker Desktop running. Use Git Bash and Node 24 or newer.

bash scripts/run_local_supabase_qa.sh --resume
echo "Exit code: $?"

Expected: 30 checkout/API checks and exit 0.
Then:
bash scripts/run_local_operations_qa.sh --resume
echo "Exit code: $?"

Expected: 54 operations checks and exit 0.
Share PASS/FAIL lines and exit codes only; omit keys, credentials and status.json.
Runners refresh local function copies and preserve existing local database.
No reset, production link, push, merge or deploy is required.
Full Docker acceptance is pending; offline scheduling and static QA passed.
Bulk lead-time and real payment verification remain excluded.

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker version >/dev/null
if [ "${1:-}" = "--resume" ]; then
  test -f .local-supabase-qa/TCB_LOCAL_QA_ONLY
  test ! -f .local-supabase-qa/supabase/.temp/project-ref
else
  node scripts/prepare_local_supabase_qa.mjs
fi
node scripts/sync_local_qa_functions.mjs
npm install --no-save playwright pg supabase
npx playwright install chromium
qa_dir="$PWD/.local-supabase-qa"
serve_pid=''
cleanup() {
  if [ -n "$serve_pid" ]; then kill "$serve_pid" 2>/dev/null || true; fi
  npx supabase stop --workdir "$qa_dir" >/dev/null 2>&1 || true
}
trap cleanup EXIT
npx supabase start --workdir "$qa_dir"
npx supabase status --workdir "$qa_dir" -o json > "$qa_dir/status.json"
npx supabase functions serve --workdir "$qa_dir" > "$qa_dir/functions.log" 2>&1 &
serve_pid=$!
node scripts/prepare_local_delivery_qa.mjs
node scripts/wait_local_supabase_qa.mjs
node scripts/local_supabase_checkout_qa.mjs

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .local-supabase-qa/TCB_LOCAL_QA_ONLY || { echo 'Missing local QA marker. Stop: do not create one manually.'; exit 1; }
test ! -f .local-supabase-qa/supabase/.temp/project-ref || { echo 'Refusing linked project.'; exit 1; }
docker version >/dev/null
npm install --no-save playwright pg supabase esbuild @supabase/supabase-js
npx playwright install chromium
node scripts/sync_local_qa_functions.mjs
node scripts/prepare_local_operations_qa.mjs
npx supabase start --workdir .local-supabase-qa
npx supabase status --workdir .local-supabase-qa -o json > .local-supabase-qa/status.json
node scripts/prepare_local_delivery_qa.mjs
npx supabase functions serve --workdir .local-supabase-qa --env-file .local-supabase-qa/operations.env

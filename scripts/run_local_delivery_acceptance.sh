#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/wait_local_supabase_qa.mjs
node scripts/local_supabase_checkout_qa.mjs
node scripts/local_operations_qa.mjs

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install --prefix .migration-rehearsal --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
node scripts/migration_upgrade_qa.mjs

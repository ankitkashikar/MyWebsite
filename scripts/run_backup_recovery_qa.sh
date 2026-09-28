#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/backup_recovery_qa.mjs --docker

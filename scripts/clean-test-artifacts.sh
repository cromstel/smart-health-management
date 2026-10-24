#!/usr/bin/env bash
# Clean only safe, non-user build/agent artifacts. Never touch user's data,
# environment files, database files, or source files.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

echo "Cleaning safe artifacts only..."

# Build caches (safe to rebuild)
rm -rf dist/ .tmp-*.mts .tmp-*.mjs deploy/app.zip deploy/bridge/*.log deploy/bridge/*.err 2>/dev/null || true

# Agent temp artifacts from this session (bridge logs, temp scripts)
rm -rf deploy/bridge/serve-file.mjs deploy/bridge/serve.mjs deploy/bridge/serve-env.mjs 2>/dev/null || true
rm -f deploy/bridge/file.log deploy/bridge/bridge.log deploy/bridge/bridge.err deploy/bridge/file.info deploy/bridge/file2.log 2>/dev/null || true
rm -f server/.tmp-verify.mts server/.tmp-idem.mts server/dbcheck.cjs 2>/dev/null || true

# npm / build caches that don't contain user's data
npm cache clean --force 2>/dev/null || true

echo "Cleaned. User data (.env*, node_modules, DB, source) preserved."

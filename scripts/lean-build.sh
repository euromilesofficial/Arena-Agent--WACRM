#!/usr/bin/env bash
# lean-build.sh — the build step of the working cycle. Fetches what the build needs from Git, builds,
# and moves the zip into release/ so it stays in the repository instead of the parent folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -f src/lib/theme-font-data.ts ]; then
  echo "· fetching font data from Git"
  bash scripts/git-fetch.sh src/lib/theme-font-data.ts
fi
if [ ! -d node_modules ]; then
  echo "· installing dependencies from package-lock.json"
  npm ci --no-audit --no-fund >/tmp/lean-npm.log 2>&1 || { tail -20 /tmp/lean-npm.log; exit 1; }
fi
echo "· building"
npm run build > /tmp/lean-build.log 2>&1 || { tail -40 /tmp/lean-build.log; exit 1; }
mkdir -p release
if [ -f "$ROOT/../wacrm-app.zip" ]; then mv -f "$ROOT/../wacrm-app.zip" release/wacrm-app.zip; fi
echo "· built WACRM-CMS.html ($(stat -c %s WACRM-CMS.html) bytes, md5 $(md5sum WACRM-CMS.html | cut -c1-32))"
echo "· packaged release/wacrm-app.zip ($(stat -c %s release/wacrm-app.zip) bytes)"

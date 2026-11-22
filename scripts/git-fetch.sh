#!/usr/bin/env bash
# git-fetch.sh — restore one or more tracked files from GitHub into the workspace, on demand.
#
#   scripts/git-fetch.sh WACRM-CMS.html src/lib/theme-font-data.ts
#   scripts/git-fetch.sh --list            # show what Git holds that is not in the workspace
#
# The workspace keeps only working files. Large generated or reference files live on GitHub
# and are fetched when a build or a check needs them. Nothing is written back to GitHub here.
set -euo pipefail
REPO="euromilesofficial/Arena-Agent--WACRM"
BRANCH="main"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f /home/user/.gh-token ]; then TOKEN=$(cat /home/user/.gh-token); fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
URL="https://x-access-token:${TOKEN}@github.com/${REPO}.git"
git clone -q --filter=blob:none --no-checkout --branch "$BRANCH" "$URL" "$TMP/repo"
cd "$TMP/repo"
if [ "${1:-}" = "--list" ]; then
  git ls-tree -r HEAD --name-only | while read -r p; do [ -e "$ROOT/$p" ] || echo "$p"; done
  exit 0
fi
[ $# -ge 1 ] || { echo "usage: $0 <path> [path...]" >&2; exit 2; }
for p in "$@"; do
  mkdir -p "$ROOT/$(dirname "$p")"
  git show "HEAD:$p" > "$ROOT/$p"
  echo "restored $p ($(stat -c %s "$ROOT/$p") bytes)"
done

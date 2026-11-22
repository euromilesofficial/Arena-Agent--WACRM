#!/usr/bin/env bash
# workspace-clean.sh — remove regenerable and cache files from the workspace, only after each one is
# confirmed in GitHub. Dry run by default; pass --apply to delete.
#   bash scripts/workspace-clean.sh          # show what would be removed
#   bash scripts/workspace-clean.sh --apply  # remove it
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
REPO="euromilesofficial/Arena-Agent--WACRM"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f /home/user/.gh-token ]; then TOKEN=$(cat /home/user/.gh-token); fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --branch main "https://x-access-token:${TOKEN}@github.com/${REPO}.git" "$TMP/repo"

# files that are removable: must exist in Git with the same content
keep_if_in_git() {
  local path="$1"
  if [ ! -e "$path" ]; then return 0; fi
  if [ -d "$path" ]; then
    echo "  dir  $path"
    if [ $APPLY = 1 ]; then rm -rf "$path"; fi
    return 0
  fi
  local local_sum git_sum
  local_sum=$(md5sum "$path" | cut -c1-32)
  git_sum=$( (cd "$TMP/repo" && [ -e "$path" ] && md5sum "$path" | cut -c1-32) || true)
  if [ -n "$git_sum" ] && [ "$local_sum" = "$git_sum" ]; then
    echo "  file $path  (in GitHub, same content)"
    if [ $APPLY = 1 ]; then rm -f "$path"; fi
  else
    echo "  KEEP $path  (not confirmed in GitHub — save with git-sync.sh first)"
  fi
}

echo "Removable (generated files confirmed in GitHub; caches rebuilt from the lockfile):"
for d in node_modules dist; do keep_if_in_git "$d"; done
for f in WACRM-CMS.html src/lib/theme-font-data.ts release/wacrm-app.zip; do keep_if_in_git "$f"; done
if [ -d qa ]; then
  for f in $(find qa -type f ! -name '.gitkeep'); do keep_if_in_git "$f"; done
fi
if [ -e ../wacrm-app.zip ]; then echo "  KEEP ../wacrm-app.zip  (outside the repo — lean-build.sh moves it into release/)"; fi
if [ $APPLY = 1 ]; then echo "applied."; else echo "dry run — nothing deleted. Re-run with --apply."; fi

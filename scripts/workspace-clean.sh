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
    [ $APPLY = 1 ] && rm -rf "$path"
    return 0
  fi
  local local_sum git_sum
  local_sum=$(md5sum "$path" | cut -c1-32)
  git_sum=$( (cd "$TMP/repo" && [ -e "$path" ] && md5sum "$path" | cut -c1-32) || true)
  if [ -n "$git_sum" ] && [ "$local_sum" = "$git_sum" ]; then
    echo "  file $path  (in GitHub, same content)"
    [ $APPLY = 1 ] && rm -f "$path"
  else
    echo "  KEEP $path  (not confirmed in GitHub — save with git-sync.sh first)"
  fi
}

echo "Removable (confirmed in GitHub):"
for d in node_modules dist; do [ -e "$d" ] && keep_if_in_git "$d"; done
for f in WACRM-CMS.html src/lib/theme-font-data.ts release/wacrm-app.zip; do [ -e "$f" ] && keep_if_in_git "$f"; done
if [ -d qa ]; then
  for f in $(find qa -type f ! -name '.gitkeep'); do keep_if_in_git "$f"; done
fi
for z in ../wacrm-app.zip; do [ -e "$z" ] && { echo "  KEEP $z  (outside the repo — move into release/ with lean-build.sh)"; }; done
[ $APPLY = 1 ] && echo "applied." || echo "dry run — nothing deleted. Re-run with --apply."

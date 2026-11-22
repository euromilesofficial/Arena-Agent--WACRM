#!/usr/bin/env bash
# git-sync.sh — save the workspace's working files to GitHub, without keeping a .git here.
#
#   scripts/git-sync.sh "what changed"
#
# It clones the repository into a temporary folder, copies in every working file that exists
# in the workspace, commits what changed, pushes, verifies the remote head, and removes the clone.
# Files that are absent from the workspace (moved to Git only) are left as they are on GitHub.
set -euo pipefail
MSG="${1:-}"
[ -n "$MSG" ] || { echo "usage: $0 \"what changed\"" >&2; exit 2; }
REPO="euromilesofficial/Arena-Agent--WACRM"
BRANCH="main"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f /home/user/.gh-token ]; then TOKEN=$(cat /home/user/.gh-token); fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
URL="https://x-access-token:${TOKEN}@github.com/${REPO}.git"
git clone -q --branch "$BRANCH" "$URL" "$TMP/repo"
cd "$TMP/repo"
git config user.name "Arena Agent"; git config user.email "agent@arena.ai"
# copy working files only; never delete, never copy secrets, build caches or local captures
( cd "$ROOT" && tar -cf - \
    --exclude=./.git --exclude=./node_modules --exclude=./dist --exclude=./qa \
    --exclude='.gh-token*' --exclude='*.token' --exclude=./.env --exclude='.env.*' \
    --exclude=__pycache__ --exclude='*.pyc' . ) | ( cd "$TMP/repo" && tar -xf - )
git add -A
if git diff --cached --quiet; then echo "nothing to save: GitHub already matches the workspace"; exit 0; fi
git commit -q -m "$MSG"
git push -q "$URL" "$BRANCH"
REMOTE=$(git ls-remote "$URL" "refs/heads/$BRANCH" | cut -f1)
LOCAL=$(git rev-parse HEAD)
[ "$REMOTE" = "$LOCAL" ] || { echo "! remote $REMOTE differs from local $LOCAL" >&2; exit 1; }
echo "saved ${LOCAL:0:7} → github.com/${REPO} (verified)"

#!/usr/bin/env bash
# checkpoint.sh — the end-of-task routine, automated.
#
#   ./checkpoint.sh "what changed" [tag]
#
# The standing instruction from the user: whenever a file is created, anything is
# modified, or a task is finished, everything goes to GitHub. This script is that
# instruction, executable:
#
#   1. rebuild the single-file app + HANDOVER.md + wacrm-app.zip   (if deps exist)
#   2. mirror wacrm-app/ into the clone at /home/user/repo
#   3. commit — never with an empty message, never with a dirty tree left behind
#   4. push main and every tag, then verify the remote head matches the local head
#
# It is safe to run twice: step 3 becomes a no-op when nothing changed, and step 4
# then reports "already up to date".
set -euo pipefail

MSG="${1:?usage: checkpoint.sh \"commit message\" [tag]}"
TAG="${2:-}"
APP=/home/user/wacrm-app
REPO=/home/user/repo
TOKEN_FILE=/home/user/.gh-token
OWNER_REPO=euromilesofficial/Arena-Agent--WACRM

cd "$APP"

# ---------- 1 · build + package ----------
if [ -d node_modules ]; then
  npm run --silent build 2>&1 | tail -3
else
  echo "· node_modules absent — building would need 'npm ci'; regenerating docs + zip only"
  node scripts/handover.mjs
  node scripts/package.mjs | tail -2
fi

# ---------- 2 · mirror the tree into the clone ----------
cd "$REPO"
git config user.name "Arena Agent"
git config user.email "agent@arena.ai"
git config core.hooksPath .githooks

# copy everything the clone should own, minus node_modules/dist/build junk
( cd "$APP" && tar -cf - \
    --exclude=node_modules --exclude=dist --exclude='qa/*.webp' --exclude='qa/*.png' \
    . ) | tar -xf - -C "$REPO"

# the workspace-level docs travel too
cp -f /home/user/PUSH-TO-GIT.md "$REPO/PUSH-TO-GIT.md" 2>/dev/null || true

# tar preserves the source mode, and the hook must stay executable or it is silently skipped
chmod +x "$REPO/.githooks/pre-commit" "$REPO/push-to-github.sh" 2>/dev/null || true

# ---------- 3 · commit ----------
git add -A
if git diff --cached --quiet; then
  echo "· nothing to commit — the clone already matches the workspace"
else
  git commit -q -m "$MSG"
  echo "· committed $(git rev-parse --short HEAD)"
fi
[ -n "$TAG" ] && git tag -f -a "$TAG" -m "$MSG" >/dev/null && echo "· tagged $TAG"

# ---------- 4 · push ----------
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then TOKEN=$(cat "$TOKEN_FILE"); fi
if [ -z "$TOKEN" ]; then
  echo "! no credential: set GH_TOKEN or write it to $TOKEN_FILE" >&2
  exit 1
fi

URL="https://x-access-token:${TOKEN}@github.com/${OWNER_REPO}.git"
git fetch -q "$URL" "+refs/heads/*:refs/remotes/origin/*"
BEHIND=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo 0)
if [ "$BEHIND" != "0" ]; then
  echo "! origin/main is $BEHIND commit(s) ahead — refusing a non-fast-forward push" >&2
  exit 1
fi

git push -q "$URL" main --tags 2>&1 | sed "s/${TOKEN}/***/g"
REMOTE=$(git ls-remote "$URL" refs/heads/main | cut -f1)
LOCAL=$(git rev-parse main)
echo "· pushed ${LOCAL:0:7} → github.com/${OWNER_REPO}"
[ "$REMOTE" = "$LOCAL" ] && echo "✓ GitHub matches the workspace" || { echo "! remote head differs ($REMOTE)" >&2; exit 1; }

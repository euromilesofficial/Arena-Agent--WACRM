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
#   2. commit — never with an empty message, never with a dirty tree left behind
#   3. push main and every tag, then verify the remote head matches the local head
#
# ---------------------------------------------------------------------------
# THERE IS NO SECOND CLONE. Until Module 6.1 this script mirrored the app folder
# into /home/user/repo and committed there — which meant the 15.5 MB artifact and
# the 14 MB font library existed twice on disk, and the workspace blew its 128 MB
# budget. The app folder is now the Git repository: one working tree, one history.
# Nothing is copied, so nothing can go stale and nothing is stored twice.
# ---------------------------------------------------------------------------
set -euo pipefail

MSG="${1:?usage: checkpoint.sh \"commit message\" [tag]}"
TAG="${2:-}"
APP=/home/user/wacrm-app
TOKEN_FILE=/home/user/.gh-token
OWNER_REPO=euromilesofficial/Arena-Agent--WACRM

cd "$APP"

# ---------- 0 · snapshot budget ----------
# The workspace has a hard 128 MB ceiling. Past 78% this rewrites history so that
# only HEAD keeps the 5 MB artifact and the 3.3 MB font data. Pruning REWRITES public
# history, so it is never run automatically: above 78% this only warns, and the user
# decides. (The old head is archived to the remote before any rewrite.)
PCT=$(node scripts/space.mjs --json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).percent)}catch{console.log(0)}})")
PCT=${PCT:-0}
if awk "BEGIN{exit !($PCT > 78)}"; then
  echo "! snapshot at ${PCT}% — history holds superseded builds. Review: node scripts/prune-history.mjs" >&2
fi

# ---------- 1 · build + package ----------
if [ -d node_modules ]; then
  npm run --silent build 2>&1 | tail -3
else
  echo "· node_modules absent — building would need 'npm ci'; regenerating docs + zip only"
  node scripts/handover.mjs
  node scripts/package.mjs | tail -2
fi

# ---------- 2 · commit ----------
git config user.name "Arena Agent"
git config user.email "agent@arena.ai"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit push-to-github.sh checkpoint.sh 2>/dev/null || true

# the credential must never be committed, however it arrived
if [ -f .gh-token ]; then echo "! .gh-token is inside the repository — move it out before committing" >&2; exit 1; fi

git add -A
if git diff --cached --quiet; then
  echo "· nothing to commit — the tree already matches HEAD"
else
  git commit -q -m "$MSG"
  echo "· committed $(git rev-parse --short HEAD)"
fi
[ -n "$TAG" ] && git tag -f -a "$TAG" -m "$MSG" >/dev/null && echo "· tagged $TAG"

# ---------- 3 · push ----------
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then chmod 600 "$TOKEN_FILE" 2>/dev/null || true; TOKEN=$(cat "$TOKEN_FILE"); fi
if [ -z "$TOKEN" ]; then
  echo "! no credential: set GH_TOKEN or write it to $TOKEN_FILE" >&2
  exit 1
fi

# the credential expires — say so before it does, not after a push fails
EXP_FILE=/home/user/.gh-token-expiry
if [ -f "$EXP_FILE" ]; then
  exp=$(date -d "$(cat "$EXP_FILE") 23:59:59Z" +%s 2>/dev/null || echo 0)
  if [ "$exp" -gt 0 ]; then
    left_h=$(( (exp - $(date +%s)) / 3600 ))
    if [ "$left_h" -lt 12 ]; then
      echo "! the GitHub token expires in ${left_h}h ($(cat "$EXP_FILE"))" >&2
      echo "  regenerate: https://github.com/settings/personal-access-tokens/22939853/regenerate" >&2
    fi
  fi
fi

URL="https://x-access-token:${TOKEN}@github.com/${OWNER_REPO}.git"
git fetch -q "$URL" "+refs/heads/*:refs/remotes/origin/*"
BEHIND=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo 0)
if [ "$BEHIND" != "0" ]; then
  echo "! origin/main is $BEHIND commit(s) ahead — refusing a non-fast-forward push" >&2
  exit 1
fi

# main only: rollback tags are immutable markers and are never moved by a checkpoint.
# A new tag (the optional second argument) is pushed on its own.
git push -q "$URL" main 2>&1 | sed "s/${TOKEN}/***/g"
[ -n "$TAG" ] && git push -q "$URL" "refs/tags/$TAG" 2>&1 | sed "s/${TOKEN}/***/g"
REMOTE=$(git ls-remote "$URL" refs/heads/main | cut -f1)
LOCAL=$(git rev-parse main)
echo "· pushed ${LOCAL:0:7} → github.com/${OWNER_REPO}"
[ "$REMOTE" = "$LOCAL" ] && echo "✓ GitHub matches the workspace" || { echo "! remote head differs ($REMOTE)" >&2; exit 1; }

# ---------- 4 · say what the workspace weighs ----------
echo "· workspace: tree $(du -sh --exclude=node_modules --exclude=dist --exclude=.git . | cut -f1) + .git $(du -sh .git | cut -f1) + zip $(du -sh "$APP/../wacrm-app.zip" 2>/dev/null | cut -f1)"

node scripts/space.mjs | tail -9

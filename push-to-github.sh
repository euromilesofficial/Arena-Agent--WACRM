#!/usr/bin/env bash
# Push the local history to euromilesofficial/Arena-Agent--WACRM.
#
# Why a script: this sandbox does not persist ~/.gitconfig or repo/.git/config,
# so the remote and the author identity have to be re-established every session.
# Running this is all it takes once a token is available.
#
#   GITHUB_TOKEN=ghp_xxx ./push-to-github.sh
#
# The token is used for a single command and never written to disk, to the
# remote URL, or to shell history. Scope needed: Contents = Read and write.
set -euo pipefail

REPO=/home/user/repo
OWNER_REPO=euromilesofficial/Arena-Agent--WACRM
BRANCH=main

cd "$REPO"

git config user.name "Arena Agent"
git config user.email "agent@arena.ai"
git config core.hooksPath .githooks

# A clean tree keeps the push honest — the zip is the deliverable, the repo the log.
if [ -n "$(git status --porcelain)" ]; then
  echo "! working tree is dirty; commit or discard first:" >&2
  git status --short >&2
  exit 1
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  cat >&2 <<'MSG'
No GITHUB_TOKEN in the environment.

Two ways forward, both credential-free for me:

A) You run this locally, with your own token:
     GITHUB_TOKEN=ghp_xxx ./push-to-github.sh

B) You take the bundle and merge it yourself (no token leaves your machine):
     git clone https://github.com/euromilesofficial/Arena-Agent--WACRM.git
     cd Arena-Agent--WACRM
     git fetch /path/to/wacrm-app.bundle main:agent/main
     git merge --ff-only agent/main
     git push origin main
MSG
  exit 1
fi

echo "→ fetching $OWNER_REPO"
git fetch --prune "https://x-access-token:${GITHUB_TOKEN}@github.com/${OWNER_REPO}.git" \
  "+refs/heads/*:refs/remotes/origin/*" >/dev/null

AHEAD=$(git rev-list --count origin/${BRANCH}..${BRANCH} 2>/dev/null || echo "?")
BEHIND=$(git rev-list --count ${BRANCH}..origin/${BRANCH} 2>/dev/null || echo "?")

if [ "$BEHIND" != "0" ]; then
  echo "! origin/${BRANCH} has $BEHIND commit(s) that are not local — refusing a non-fast-forward push." >&2
  echo "  Merge or rebase first; nothing is forced here." >&2
  exit 1
fi

echo "→ $AHEAD commit(s) ahead, $BEHIND behind — fast-forward, pushing branch and tags"
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${OWNER_REPO}.git" \
  "${BRANCH}:${BRANCH}" "--tags" 2>&1 | sed "s/${GITHUB_TOKEN}/***/g"

echo "→ verifying"
REMOTE_HEAD=$(git ls-remote "https://x-access-token:${GITHUB_TOKEN}@github.com/${OWNER_REPO}.git" "refs/heads/${BRANCH}" | cut -f1)
LOCAL_HEAD=$(git rev-parse ${BRANCH})
echo "   remote ${BRANCH}: $REMOTE_HEAD"
echo "   local  ${BRANCH}: $LOCAL_HEAD"
[ "$REMOTE_HEAD" = "$LOCAL_HEAD" ] && echo "OK — GitHub matches the workspace." || { echo "! heads differ" >&2; exit 1; }

#!/usr/bin/env bash
# Commit + push the WACRM workspace to GitHub.
#
#   GH_TOKEN=github_pat_...  /home/user/agent-commit.sh "commit message" [tag]
#
# Re-establishes identity and remote first: the sandbox drops .git/config
# between sessions, so the clone comes back without them.
set -euo pipefail
MSG="${1:?usage: agent-commit.sh \"message\" [tag]}"
TAG="${2:-}"
REPO=/home/user/repo
REMOTE=https://github.com/euromilesofficial/Arena-Agent--WACRM.git
: "${GH_TOKEN:?set GH_TOKEN to a fine-grained token with Contents: write}"

cd "$REPO"
git config user.email "agent@arena.ai"
git config user.name  "Arena Agent"

# mirror the verified workspace into the clone (never node_modules / dist)
for d in src qa; do rm -rf "./$d"; cp -a "/home/user/wacrm-app/$d" "./$d"; done
for f in $(cd /home/user/wacrm-app && ls -1 *.md *.py *.html *.json *.ts *.txt 2>/dev/null); do
  cp -a "/home/user/wacrm-app/$f" "./$f"
done

# the zip is a deliverable, not an artefact: rebuild it on every checkpoint
cd /home/user
rm -f wacrm-app.zip
zip -rq wacrm-app.zip wacrm-app -x "wacrm-app/node_modules/*" "wacrm-app/dist/*" "wacrm-app/.git/*"
echo "zip: $(du -h wacrm-app.zip | cut -f1), $(unzip -l wacrm-app.zip | tail -1 | awk '{print $2}') files"

cd "$REPO"
git add -A
if git diff --cached --quiet; then
  echo "nothing to commit — workspace matches the clone"
else
  git commit -q -m "$MSG"
fi
[ -n "$TAG" ] && git tag -f -a "$TAG" -m "$MSG"

git push -q "https://x-access-token:${GH_TOKEN}@${REMOTE#https://}" main
[ -n "$TAG" ] && git push -q "https://x-access-token:${GH_TOKEN}@${REMOTE#https://}" "$TAG"

git log --oneline --decorate -1
[ -n "$TAG" ] && echo "tagged: $TAG"
echo "pushed → https://github.com/euromilesofficial/Arena-Agent--WACRM"

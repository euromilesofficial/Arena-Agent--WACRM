#!/usr/bin/env bash
source /home/user/wacrm-app/scripts/qa-env.sh >/dev/null 2>&1
cd /home/user/wacrm-app
node scripts/qa-all.mjs > /home/user/qaall.log 2>&1
echo "QA_EXIT $?" >> /home/user/qaall.log

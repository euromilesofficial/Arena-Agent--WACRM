#!/usr/bin/env bash
# QA environment bootstrap — the sandbox has no root, so Chromium's shared
# libraries are extracted into /tmp instead of installed system-wide.
#
#   source scripts/qa-env.sh      # exports LD_LIBRARY_PATH for this shell
#   python3 qa_library.py
#
# /tmp is wiped between sessions; re-run this whenever a browser fails with
# "error while loading shared libraries".
set -euo pipefail
ROOT=/tmp/libs/root
NEEDED="libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
libatspi2.0-0t64 libasound2t64 libxkbcommon0 libxdamage1 libxcomposite1"

if [ ! -f "$ROOT/usr/lib/x86_64-linux-gnu/libnspr4.so" ]; then
  mkdir -p /tmp/libs && cd /tmp/libs
  apt-get download $NEEDED >/dev/null 2>&1 || true
  for f in *.deb; do dpkg-deb -x "$f" "$ROOT" 2>/dev/null || true; done
  echo "· chromium libraries extracted into $ROOT"
fi
if ! python3 -c "import playwright" >/dev/null 2>&1; then
  pip install --quiet playwright && python3 -m playwright install chromium
  echo "· playwright + chromium installed"
fi
export LD_LIBRARY_PATH="$ROOT/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
echo "· LD_LIBRARY_PATH set — run any qa_*.py now"

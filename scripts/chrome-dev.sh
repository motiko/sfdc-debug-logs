#!/usr/bin/env bash
# Launch an isolated Chrome with the unpacked extension from chrome/app loaded.
#
# Branded Chrome (137+) ignores --load-extension, so this uses Chrome for
# Testing (stable channel), downloaded into .chrome-test/.
# The profile in .chrome-test/profile persists, so a Salesforce login survives
# restarts. Remote debugging is exposed on port 9222 (override with CDP_PORT).
#
# With no url argument and a .env.local present, the browser is logged into
# Salesforce automatically via scripts/sf-login.mjs.
#
# Usage: scripts/chrome-dev.sh [url]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.chrome-test"
EXT="$ROOT/chrome/app"
PROFILE="$CACHE/profile"
PORT="${CDP_PORT:-9222}"
URL="${1:-}"
AUTO_LOGIN=0
if [ -z "$URL" ]; then
  if [ -f "$ROOT/.env.local" ]; then
    AUTO_LOGIN=1
    URL="about:blank"
  else
    URL="https://login.salesforce.com"
  fi
fi

if [ ! -f "$EXT/js/build/app.js" ]; then
  echo "chrome/app/js/build/app.js is missing; run 'npm run build' in react/ first." >&2
  exit 1
fi

CHROME="$(npx -y @puppeteer/browsers install chrome@stable --path "$CACHE" 2>/dev/null | tail -1 | cut -d' ' -f2-)"
if [ ! -x "$CHROME" ]; then
  echo "Could not install Chrome for Testing (got: $CHROME)" >&2
  exit 1
fi

"$CHROME" \
  --user-data-dir="$PROFILE" \
  --load-extension="$EXT" \
  --remote-debugging-port="$PORT" \
  --no-first-run \
  --no-default-browser-check \
  "$URL" &
CHROME_PID=$!
trap 'kill $CHROME_PID 2>/dev/null' INT TERM

if [ "$AUTO_LOGIN" = 1 ]; then
  CDP_PORT="$PORT" node "$ROOT/scripts/sf-login.mjs" || echo "Auto-login failed; log in manually." >&2
fi

wait $CHROME_PID

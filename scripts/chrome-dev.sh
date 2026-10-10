#!/usr/bin/env bash
# Launch an isolated Chrome with the unpacked extension from chrome/app loaded.
#
# Regular Chrome (137+) ignores --load-extension and no longer runs Manifest V2
# extensions, so this uses Chrome for Testing 138, the last version where MV2
# can be re-enabled with feature flags. It is downloaded once into .chrome-test/.
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
  echo "chrome/app/js/build/app.js is missing; run 'npm run build:chrome' in react/ first." >&2
  exit 1
fi

CHROME="$(npx -y @puppeteer/browsers install chrome@138 --path "$CACHE" 2>/dev/null | tail -1 | cut -d' ' -f2-)"
if [ ! -x "$CHROME" ]; then
  echo "Could not install Chrome for Testing 138 (got: $CHROME)" >&2
  exit 1
fi

"$CHROME" \
  --user-data-dir="$PROFILE" \
  --load-extension="$EXT" \
  --disable-features=ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported \
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

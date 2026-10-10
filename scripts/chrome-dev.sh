#!/usr/bin/env bash
# Launch an isolated Chrome with the unpacked extension from chrome/app loaded.
#
# Regular Chrome (137+) ignores --load-extension and no longer runs Manifest V2
# extensions, so this uses Chrome for Testing 138, the last version where MV2
# can be re-enabled with feature flags. It is downloaded once into .chrome-test/.
# The profile in .chrome-test/profile persists, so a Salesforce login survives
# restarts. Remote debugging is exposed on port 9222 (override with CDP_PORT).
#
# Usage: scripts/chrome-dev.sh [url]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.chrome-test"
EXT="$ROOT/chrome/app"
PROFILE="$CACHE/profile"
PORT="${CDP_PORT:-9222}"
URL="${1:-https://login.salesforce.com}"

if [ ! -f "$EXT/js/build/app.js" ]; then
  echo "chrome/app/js/build/app.js is missing; run 'npm run build:chrome' in react/ first." >&2
  exit 1
fi

CHROME="$(npx -y @puppeteer/browsers install chrome@138 --path "$CACHE" 2>/dev/null | tail -1 | cut -d' ' -f2-)"
if [ ! -x "$CHROME" ]; then
  echo "Could not install Chrome for Testing 138 (got: $CHROME)" >&2
  exit 1
fi

exec "$CHROME" \
  --user-data-dir="$PROFILE" \
  --load-extension="$EXT" \
  --disable-features=ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported \
  --remote-debugging-port="$PORT" \
  --no-first-run \
  --no-default-browser-check \
  "$URL"

#!/usr/bin/env bash
# Package chrome/app into dist/apex-debugger-<version>.zip for the Chrome
# Web Store. Uses the bundle currently in chrome/app/js/build/app.js, so
# build first (npm run build in react/). Prints the zip path.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/chrome/app/manifest.json').version")"
OUT="$ROOT/dist/apex-debugger-$VERSION.zip"

if [ ! -s "$ROOT/chrome/app/js/build/app.js" ]; then
  echo "chrome/app/js/build/app.js is missing; run 'npm run build' in react/ first." >&2
  exit 1
fi

mkdir -p "$ROOT/dist"
rm -f "$OUT"
(cd "$ROOT/chrome/app" && zip -q -r -X "$OUT" . -x '*.DS_Store' '*.zip' 'js/build/.gitignore')
echo "$OUT"

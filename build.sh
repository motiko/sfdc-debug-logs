#!/usr/bin/env bash
# Builds the extension so chrome/app can be loaded unpacked.
#
#   ./build.sh          install dependencies if needed, then build
#   ./build.sh --watch  rebuild on every save (reload the app page after)
#   ./build.sh --zip    build, then package chrome/app as apex-debugger.zip
set -euo pipefail

cd "$(dirname "$0")"

# Install when node_modules is missing or older than the lockfile.
if [ ! -d react/node_modules ] || [ react/package-lock.json -nt react/node_modules ]; then
  npm ci --prefix react
fi

case "${1:-}" in
  --watch) exec npm run dev --prefix react ;;
  --zip)
    npm run build --prefix react
    rm -f apex-debugger.zip
    (cd chrome/app && zip -qr -X ../../apex-debugger.zip . -x '*.DS_Store' '*.map' 'js/build/.gitignore')
    echo "Built apex-debugger.zip" ;;
  "")
    npm run build --prefix react
    echo "Built. Load chrome/app unpacked (chrome://extensions > Load unpacked)." ;;
  *)
    echo "Usage: ./build.sh [--watch | --zip]" >&2
    exit 1 ;;
esac

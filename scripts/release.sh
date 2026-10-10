#!/usr/bin/env bash
# Release helper. See RELEASING.md.
#
#   scripts/release.sh prepare <version>   bump the manifest version on a new
#                                          release/v<version> branch, rebuild
#                                          the bundle, push and open a PR
#   scripts/release.sh tag                 after that PR is merged: tag main
#                                          with v<manifest version> and push,
#                                          which starts the publish workflow

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/chrome/app/manifest.json"
cd "$ROOT"

die() { echo "$*" >&2; exit 1; }
manifest_version() { node -p "require('$MANIFEST').version"; }
require_clean() {
  [ -z "$(git status --porcelain --untracked-files=no)" ] || die "Working tree has uncommitted changes."
}

prepare() {
  local version="${1:-}"
  [[ "$version" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]] || die "Usage: scripts/release.sh prepare <version>, e.g. 0.8.1"
  require_clean
  git fetch -q origin main --tags
  git rev-parse -q --verify "refs/tags/v$version" >/dev/null && die "Tag v$version already exists."
  git checkout -q -b "release/v$version" origin/main
  node -e "
    const fs = require('fs')
    const text = fs.readFileSync('$MANIFEST', 'utf8')
    fs.writeFileSync('$MANIFEST', text.replace(/(\"version\":\s*\")[^\"]+(\")/, '\$1$version\$2'))
  "
  [ "$(manifest_version)" = "$version" ] || die "Could not update the manifest version."
  npm --prefix react run build --silent
  git add chrome/app/manifest.json chrome/app/js/build/app.js
  git commit -q -m "Release v$version"
  git push -q -u origin "release/v$version"
  gh pr create --base main --head "release/v$version" --title "Release v$version" \
    --body "Bumps the extension to v$version and rebuilds the bundle. After merging, run \`scripts/release.sh tag\` to publish (see RELEASING.md)."
}

tag() {
  require_clean
  git fetch -q origin main --tags
  [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "Check out main first."
  git merge -q --ff-only origin/main
  local version
  version="$(manifest_version)"
  git rev-parse -q --verify "refs/tags/v$version" >/dev/null && die "Tag v$version already exists; bump the version with 'prepare' first."
  git tag -a "v$version" -m "Release v$version"
  git push -q origin "v$version"
  echo "Pushed v$version. Follow the publish run with: gh run watch \$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
}

case "${1:-}" in
  prepare) shift; prepare "$@" ;;
  tag) tag ;;
  *) die "Usage: scripts/release.sh prepare <version> | tag" ;;
esac

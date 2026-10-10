#!/usr/bin/env bash
# Bumps the version in chrome/app/manifest.json, commits and tags vX.Y.Z,
# like `yarn version`. Push with `git push --follow-tags` to release.
#
# Usage: scripts/version.sh patch|minor|major|<x.y.z>

set -euo pipefail

cd "$(dirname "$0")/.."
MANIFEST=chrome/app/manifest.json

[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Commit or stash your changes first." >&2; exit 1; }

current="$(node -p "require('./$MANIFEST').version")"
IFS=. read -r major minor patch <<< "$current"
case "${1:-}" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) next="$1" ;;
  *) echo "Usage: scripts/version.sh patch|minor|major|<x.y.z>" >&2; exit 1 ;;
esac

git rev-parse -q --verify "refs/tags/v$next" >/dev/null && { echo "Tag v$next already exists." >&2; exit 1; }

node -e "
  const fs = require('fs')
  const text = fs.readFileSync('$MANIFEST', 'utf8')
  fs.writeFileSync('$MANIFEST', text.replace(/(\"version\":\s*\")[^\"]+/, '\$1$next'))
"
git commit -q -m "v$next" "$MANIFEST"
git tag -a "v$next" -m "v$next"
echo "$current -> $next. Release with: git push --follow-tags"

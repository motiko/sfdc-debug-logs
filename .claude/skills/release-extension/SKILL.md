---
name: release-extension
description: Release a new Apex Debugger version to GitHub and the Chrome Web Store. Checks readiness (main green, previous version out of review, new permissions justified), bumps and tags the version, then watches the release and store upload and explains failures. Use when asked to release, publish, tag or ship a version.
---

# Release Apex Debugger

The pipeline: `scripts/version.sh` bumps `chrome/app/manifest.json`, then commits and tags `vX.Y.Z`. Pushing the tag runs `.github/workflows/release.yml`, which:
- builds the app
- zips `chrome/app`
- creates the GitHub release
- calls `publish-chrome-web-store.yml`, which uploads the zip and submits it for review

The README's "Releasing" section and `docs/chrome-web-store-publishing.md` have the details.

Tagging and pushing publish to 20K users. Get the user's go-ahead for the version number before step 3, unless they already gave it in this conversation.

## 1. Check readiness

- **`main` is green:** check with `gh run list --branch main --workflow e2e.yml --limit 1`. If it isn't, stop and report.
- **The previous version is out of review:**
  ```sh
  gh workflow run publish-chrome-web-store.yml -f check_only=true
  ```
  Then read the run's `published: … submitted: …` line. If a version is still `PENDING_REVIEW` / submitted, the store rejects a new upload, so wait.
- **New permissions:** run `git diff <last tag>..main -- chrome/app/manifest.json`. If a `permissions` or `host_permissions` entry was added, the user must first add its justification on the dashboard's **Privacy** tab. Otherwise submitting fails with `400 INVALID_ITEM_METADATA`. Draft the justification text for them.
- **What's in it:** summarize `git log <last tag>..main --merges --oneline` for the user.

## 2. Choose the version

- **patch:** bug fixes
- **minor:** new features or UI changes
- **major:** breaking changes, such as removed features

Confirm the choice with the user.

## 3. Tag and push

```sh
git checkout main && git pull
scripts/version.sh patch          # or minor / major / x.y.z
git push --follow-tags
```

`version.sh` refuses a dirty tree or an existing tag. Never move or delete a pushed tag. If a release fails after the tag is pushed, fix forward with the next patch version.

## 4. Watch

```sh
gh run list --workflow release.yml --limit 1
gh run watch <id> --exit-status
```

Report the GitHub release URL and the store result.
- **Upload succeeded, submit failed with `INVALID_ITEM_METADATA`:** listing or privacy fields are missing. The user fills them in on the dashboard and clicks **Submit for review** there. Don't rerun the workflow: the version is already uploaded, and the store rejects the same version twice.
- **Upload failed because the previous version is in review:** after that review finishes, run `gh workflow run publish-chrome-web-store.yml -f tag=vX.Y.Z`.
- **Auth errors (403, workload identity):** see `docs/chrome-web-store-publishing.md`.

## 5. Follow up

- Comment on issues fixed in this release, with the version number, and close them.
- Update the roadmap artifact if one is in use.

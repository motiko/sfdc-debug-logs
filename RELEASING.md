# Releasing

Releases are cut from `main` by pushing a `v<version>` tag. The
[`release` workflow](.github/workflows/release.yml) then tests, packages and
publishes the extension to the Chrome Web Store. Nothing is uploaded by hand.

```
scripts/release.sh prepare 0.8.1    ->  PR "Release v0.8.1" (manifest version + rebuilt bundle)
review + merge (e2e runs on the PR)
scripts/release.sh tag              ->  pushes tag v0.8.1 on main
release workflow, job "build"       ->  tag == manifest version? tag on main?
                                        e2e flow against the org, package dist/apex-debugger-0.8.1.zip
release workflow, job "publish"     ->  waits for approval (chrome-web-store environment)
                                        upload + submit to Chrome Web Store, GitHub release with the zip
Chrome Web Store review             ->  live (review takes hours to days)
```

## Versioning

- `chrome/app/manifest.json` `version` is the single source of truth. Tags are
  `v` + that version (`v0.8.1`), matching the existing `v0.7.x` tags.
- Use `MAJOR.MINOR.PATCH`: patch for fixes, minor for features, major for
  breaking changes such as dropped Salesforce UI support.
- Every upload to the Chrome Web Store needs a version higher than the last
  one, so a version can never be reused, even if its review was rejected.

## Cutting a release

1. **Prepare.** On a clean checkout:

   ```bash
   scripts/release.sh prepare 0.8.1
   ```

   This creates `release/v0.8.1` from `origin/main`, bumps the manifest,
   rebuilds `chrome/app/js/build/app.js`, pushes and opens a PR. Check the
   e2e run on the PR is green, then merge.

2. **Tag.**

   ```bash
   git checkout main
   scripts/release.sh tag
   ```

   This fast-forwards `main`, tags it `v<manifest version>` and pushes the
   tag. The tag push starts the release workflow.

3. **Approve.** When the `build` job passes, the `publish` job waits for a
   reviewer of the `chrome-web-store` environment. Approve it from the run
   page, or:

   ```bash
   gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```

4. **Store review.** The job submits the update and prints the item state,
   normally `PENDING_REVIEW`. It goes live once Google approves it. Track it
   in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### Dry run

`gh workflow run release.yml --ref main` runs the build job only (version
check, e2e flow, packaging) and uploads the zip as a run artifact. It never
publishes. Use it to check a release candidate or to get a package to test by
hand (`chrome://extensions` > Load unpacked, after unzipping).

### If something goes wrong

- **Tag doesn't match the manifest / isn't on main:** the build job fails
  before anything is published. Delete the tag
  (`git push origin :refs/tags/v0.8.1 && git tag -d v0.8.1`), fix, and tag again.
- **e2e fails:** nothing is published. Fix on `main` through a PR. If the
  version was never uploaded, delete and re-create the tag; otherwise prepare
  the next version.
- **Upload or publish fails:** read the job log; the script prints the API
  response. Re-run the failed `publish` job once the cause is fixed.
- **A bad version is live:** the store can't roll back. Revert on `main` and
  release a new, higher version. A submission still in review can be
  withdrawn in the Developer Dashboard.

### Staged rollout

Set the `CWS_PUBLISH_TYPE` variable to `STAGED_PUBLISH` (see below) to have
approved updates wait in the dashboard until you press Publish, instead of
going live automatically.

## One-time setup

The workflow authenticates to Google with
[workload identity federation](https://github.com/google-github-actions/auth#preferred-direct-workload-identity-federation):
GitHub's OIDC token is exchanged for a short-lived access token of a service
account. There are no long-lived keys to store or rotate.

### 1. Google Cloud: service account and identity federation

The Google account that owns the extension must have
[2-step verification](https://myaccount.google.com/signinoptions/two-step-verification)
turned on. Then, with `gcloud` logged in:

```bash
PROJECT_ID=apex-debugger-release            # an existing or new project
REPO=motiko/sfdc-debug-logs
gcloud config set project "$PROJECT_ID"

gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
gcloud iam service-accounts create cws-publisher --display-name "Chrome Web Store publisher"
SA="cws-publisher@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam workload-identity-pools create github --location=global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc sfdc-debug-logs \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.repository=='$REPO' && assertion.environment=='chrome-web-store'"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/sfdc-debug-logs"
echo "GCP_SERVICE_ACCOUNT=$SA"
```

The attribute condition only accepts tokens from jobs in this repository's
`chrome-web-store` environment, so other workflows can't publish.

### 2. Chrome Web Store: allow the service account

In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
open **Account**, add the service account email (`$SA` above) and save. Only
one service account can be added per publisher. On the same page, copy the
**Publisher ID**.

### 3. GitHub: environment and variables

```bash
REPO=motiko/sfdc-debug-logs

# Environment with a required reviewer, usable from v* tags only
gh api -X PUT "repos/$REPO/environments/chrome-web-store" \
  -F "reviewers[][type]=User" -F "reviewers[][id]=$(gh api user -q .id)" \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
gh api -X POST "repos/$REPO/environments/chrome-web-store/deployment-branch-policies" \
  -f name='v*' -f type=tag

# Values from steps 1 and 2 (not secret, so stored as variables)
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --env chrome-web-store -R "$REPO" --body "projects/…/providers/sfdc-debug-logs"
gh variable set GCP_SERVICE_ACCOUNT            --env chrome-web-store -R "$REPO" --body "cws-publisher@….iam.gserviceaccount.com"
gh variable set CWS_PUBLISHER_ID               --env chrome-web-store -R "$REPO" --body "<publisher id>"
gh variable set CWS_EXTENSION_ID               --env chrome-web-store -R "$REPO" --body "mpckkbblhbfngaininanfjpdfjhbncjo"
# Optional: hold approved updates for a manual publish
gh variable set CWS_PUBLISH_TYPE               --env chrome-web-store -R "$REPO" --body "STAGED_PUBLISH"
```

The build job also needs the Salesforce secrets the e2e workflow uses
(`SF_USER`, `SF_PASS`, `SF_TOKEN`); see [CLAUDE.md](CLAUDE.md#end-to-end-flow-e2e).

### Alternative: service account key

If workload identity federation isn't an option, create a JSON key for the
service account, store it as a `chrome-web-store` environment secret
(`gh secret set GCP_CREDENTIALS_JSON --env chrome-web-store < key.json`), and
in the workflow's `google-github-actions/auth` step replace
`workload_identity_provider` and `service_account` with
`credentials_json: ${{ secrets.GCP_CREDENTIALS_JSON }}`. Keys don't expire,
so rotate them and delete `key.json` after uploading it.

## Publishing by hand

For an emergency without CI, with the service account set up as above:

```bash
npm --prefix react run build
ZIP="$(scripts/package.sh)"
CWS_ACCESS_TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$SA" --scopes=https://www.googleapis.com/auth/chromewebstore)" \
CWS_PUBLISHER_ID=<publisher id> CWS_EXTENSION_ID=mpckkbblhbfngaininanfjpdfjhbncjo \
  node scripts/cws-publish.mjs "$ZIP" "$(node -p "require('./chrome/app/manifest.json').version")"
```

Impersonating the service account requires `roles/iam.serviceAccountTokenCreator`
on it for your Google account. Tag the released commit afterwards so the
history stays complete.

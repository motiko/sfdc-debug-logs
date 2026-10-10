Apex Debugger
===============

Install Links
-----------------------------
[<img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/43.2.0/archive/chrome_12-48/chrome_12-48_128x128.png" >](https://chrome.google.com/webstore/detail/apex-debugger/mpckkbblhbfngaininanfjpdfjhbncjo)    [<img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/43.2.0/archive/firefox_3.5-22/firefox_3.5-22_128x128.png"  >](https://addons.mozilla.org/en-US/firefox/addon/apex-dbgr/)

Description
------------
Browser extension to debug salesforce code. (Chrome/Firefox)

Key Features
------------

  * Search in logs
  * Improved view of logs (select from available themes).
  * Click any Id to go to Object (Class, Trigger, Validation Rule e.t.c).
  * Indent User Debug (sObject, List, XML or JSON)
  * Delete all logs (all of'em).
  * Automatically start log tracking.
  * Customizable keyboard shortcuts for Salesforce

Keyboard Chortcuts
------------------

* _Shift+d_ - Open Debug Logs + Add current user
* _Shift+w_ - Open New logs view
* _Shift+l_ - Open last debug log
* _Shift+o_ - Custom objects page
* _Shift+u_ - Manage Users
* _Shift+p_ - Manage Profiles
* _Shift+c_ - Apex Classes
* _Shift+i_ - Company Information
* _Shift+s_ - Data Schema

Hold Alt key to open in same tab. (e.g _Alt+Shift+d_)

Quick Demo
-----------------

[![Basic usage demo   ](https://img.youtube.com/vi/4PaQhY6tSDk/0.jpg)](https://www.youtube.com/watch?v=4PaQhY6tSDk)

[![ Last log, Search, Indent, Auto Refresh, Edit   ](https://img.youtube.com/vi/FuoA07dxEGI/0.jpg)](https://www.youtube.com/watch?v=FuoA07dxEGI)

Standalone User Scripts (Not updated)
-----------------------------

GreaseMonkey scripts on [openuserjs](https://openuserjs.org/users/motiko/scripts)

Releasing
-----------------------------

```sh
git checkout main && git pull
scripts/version.sh minor    # or patch / major: bumps chrome/app/manifest.json, commits, tags vX.Y.Z
git push --follow-tags
```

Pushing the tag runs the [release workflow](.github/workflows/release.yml):

1. It checks that the tag matches the version in `chrome/app/manifest.json`.
2. It builds the React app, zips `chrome/app` and creates a GitHub release with generated notes and `apex-debugger-vX.Y.Z.zip` attached.
3. It uploads the zip to the Chrome Web Store and submits it for review ([`publish-chrome-web-store.yml`](.github/workflows/publish-chrome-web-store.yml)). The new version goes live automatically once the review passes.

The Chrome Web Store accepts no new upload while the previous version is still in review, so step 3 fails in that case. The GitHub release is created anyway. After the review finishes, publish the existing release again:

```sh
gh workflow run publish-chrome-web-store.yml -f tag=vX.Y.Z
```

The same command retries any other failed upload. Check the review state in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

If the Chrome Web Store isn't configured (see below), step 3 is skipped with a warning, and you upload the zip from the GitHub release in the dashboard by hand.

### One-time setup: Chrome Web Store publishing

The workflow authenticates without stored secrets. GitHub Actions gets an OIDC token, Google [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) exchanges it for a short-lived access token of a service account, and that service account is registered as a publisher account in the Chrome Web Store. Only workflows from this repository can use it.

You need the [gcloud CLI](https://cloud.google.com/sdk/docs/install), a Google Cloud project, and access to the Chrome Web Store developer account. If you already did this for another extension, you can reuse the project and pool: add a provider for this repository and bind the service account to it.

1. Set up the Google Cloud side:

   ```sh
   gcloud auth login
   PROJECT_ID=apex-debugger-release          # any free project ID
   REPO=motiko/sfdc-debug-logs
   REPO_ID=$(gh api repos/$REPO --jq .id)

   gcloud projects create $PROJECT_ID --name="Apex Debugger release"
   gcloud config set project $PROJECT_ID
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

   gcloud services enable chromewebstore.googleapis.com iam.googleapis.com \
     iamcredentials.googleapis.com sts.googleapis.com

   gcloud iam service-accounts create cws-publisher --display-name="Chrome Web Store publisher"
   SERVICE_ACCOUNT=cws-publisher@$PROJECT_ID.iam.gserviceaccount.com

   gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc github \
     --location=global --workload-identity-pool=github \
     --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id" \
     --attribute-condition="assertion.repository_id == '$REPO_ID' && (assertion.ref == 'refs/heads/main' || assertion.ref.startsWith('refs/tags/v'))"

   gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID"
   ```

   The condition uses the repository's numeric ID, not its name, so a renamed or recreated repository with the same name can't use the pool. It also only accepts runs from `main` or a `v*` tag, so a workflow changed on another branch can't get a token.

   Right after creating a project, Google can take a minute to apply your owner role. If a command fails with `IAM_PERMISSION_DENIED`, wait a moment and run it again.

2. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), select the publisher that owns the extension (dropdown at the top right), open **Settings**, and add the service account email (`cws-publisher@<project-id>.iam.gserviceaccount.com`) in the **Service account** section. A publisher can have only one service account.

   Don't use **Invite member** for it: an invitation only takes effect once it's accepted by email, which a service account can't do, so it stays "Pending" and the API answers `403`.

3. Note the publisher ID, shown in the publisher's **Settings**. The extension's item ID is `mpckkbblhbfngaininanfjpdfjhbncjo` (from its store URL; the ID in the dashboard's address bar is a different one, which the API rejects with `403`). Then set the repository variables:

   ```sh
   gh variable set CWS_PUBLISHER_ID --body "<publisher id>"
   gh variable set CWS_EXTENSION_ID --body "mpckkbblhbfngaininanfjpdfjhbncjo"
   gh variable set GCP_SERVICE_ACCOUNT --body "$SERVICE_ACCOUNT"
   gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER \
     --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"
   ```

   These are variables, not secrets: none of them grants access on its own.

4. Anyone who can push a `v*` tag can publish, because the workflow runs from the tagged commit. Allow only admins to create, move or delete release tags:

   ```sh
   gh api -X POST repos/$REPO/rulesets --input - <<'JSON'
   {"name": "Release tags", "target": "tag", "enforcement": "active",
    "conditions": {"ref_name": {"include": ["refs/tags/v*"], "exclude": []}},
    "rules": [{"type": "creation"}, {"type": "update"}, {"type": "deletion"}],
    "bypass_actors": [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]}
   JSON
   ```

   `actor_id` 5 is the repository admin role, so you can still push release tags.

5. Check the setup without uploading anything:

   ```sh
   gh workflow run publish-chrome-web-store.yml -f check_only=true
   ```

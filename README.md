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

The workflow authenticates without stored secrets. GitHub Actions gets an OIDC token, Google [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) exchanges it for a short-lived access token of a service account, and that service account is registered as a publisher account in the Chrome Web Store.

This repository shares the Google Cloud project `kcr-translate-release` (pool and provider `github`, service account `cws-publisher`) with [kcr-translate-ext](https://github.com/motiko/kcr-translate-ext) and any-translate, which publish under the same Chrome Web Store publisher. The provider only accepts tokens from the repository IDs in its condition. Creating the project, pool, provider and service account from scratch is described in kcr-translate-ext's README.

You need the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and owner access to the project.

1. Allow this repository on the shared provider and service account:

   ```sh
   gcloud auth login
   gcloud config set project kcr-translate-release
   REPO=motiko/sfdc-debug-logs
   REPO_ID=$(gh api repos/$REPO --jq .id)    # 25717851
   SERVICE_ACCOUNT=cws-publisher@kcr-translate-release.iam.gserviceaccount.com
   PROVIDER=projects/745435432082/locations/global/workloadIdentityPools/github/providers/github

   # Shows the repository IDs allowed now
   gcloud iam workload-identity-pools providers describe github \
     --location=global --workload-identity-pool=github --format='value(attributeCondition)'

   # Replaces the whole condition: list every ID from above plus $REPO_ID
   gcloud iam workload-identity-pools providers update-oidc github \
     --location=global --workload-identity-pool=github \
     --attribute-condition="assertion.repository_id in ['171104265', '367571871', '$REPO_ID']"

   gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/745435432082/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID"
   ```

   The condition uses numeric repository IDs, not names, so a renamed or recreated repository with the same name can't use the pool. `update-oidc` overwrites the condition, so dropping an ID from the list locks that repository out.

2. The service account must be the service account of the publisher that owns the extension. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), select that publisher (dropdown at the top right), open **Settings**, and check that `cws-publisher@kcr-translate-release.iam.gserviceaccount.com` is in the **Service account** section; add it if not. A publisher can have only one service account.

   Don't use **Invite member** for it: an invitation only takes effect once it's accepted by email, which a service account can't do, so it stays "Pending" and the API answers `403`.

3. Set the repository variables. The publisher ID is shown in the publisher's **Settings**. The extension's item ID is `mpckkbblhbfngaininanfjpdfjhbncjo` (from its store URL; the ID in the dashboard's address bar is a different one, which the API rejects with `403`).

   ```sh
   gh variable set CWS_PUBLISHER_ID -R $REPO --body "c6806d54-95d7-4251-9f55-f5b9c56af19f"
   gh variable set CWS_EXTENSION_ID -R $REPO --body "mpckkbblhbfngaininanfjpdfjhbncjo"
   gh variable set GCP_SERVICE_ACCOUNT -R $REPO --body "$SERVICE_ACCOUNT"
   gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER -R $REPO --body "$PROVIDER"
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

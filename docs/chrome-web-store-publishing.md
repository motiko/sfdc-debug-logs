# Chrome Web Store publishing setup

One-time setup for the Chrome Web Store step of the [release workflow](../README.md#releasing). It only has to be redone when the Google Cloud or Chrome Web Store side changes.

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

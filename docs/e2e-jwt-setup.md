# Logging in to the e2e org with the OAuth 2.0 JWT bearer flow

The e2e flow, the UX audit and `scripts/sf-login.mjs` log in to a real Salesforce org through `scripts/lib/sf-auth.mjs`. Salesforce retires SOAP `login()` in Summer '27, so they log in with the [OAuth 2.0 JWT bearer flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm) instead: the script signs a short-lived assertion (RS256, `node:crypto`, `scripts/lib/sf-jwt.mjs`) with a private key, and Salesforce exchanges it at `<login URL>/services/oauth2/token` for an access token. No password or security token is needed, and the browser still signs in through `frontdoor.jsp` with that token.

SOAP stays as a fallback for an org whose `SF_CLIENT_ID` and key aren't set (it prints a warning). Once JWT works, remove `SF_PASS` and `SF_TOKEN`.

Do this once per org (the second, fallback org needs its own app and key).

## 1. Make a key and a certificate

From the repository root (`*.pem` is gitignored):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 730 \
  -subj "/CN=apex-debugger-e2e" \
  -keyout sf-jwt-key.pem -out sf-jwt-cert.pem
```

`sf-jwt-key.pem` is the secret. `sf-jwt-cert.pem` is public: it goes to Salesforce. Note the expiry date (730 days): renew both before then.

## 2. Create the External Client App

In Setup, **External Client App Manager** > **New External Client App**:

- Name `Apex Debugger e2e`, a contact email, distribution state **Local**.
- **Enable OAuth**. Callback URL: `http://localhost:1717/OauthRedirect` (required, never used).
- OAuth scopes:
  - **Manage user data via APIs (api)**: REST, Tooling and Bulk API.
  - **Manage user data via Web browsers (web)**: needed for `frontdoor.jsp`, which signs the test browser in with the token.
  - **Perform requests at any time (refresh_token, offline_access)**.
- Flow enablement: **Enable JWT Bearer Flow**, and upload `sf-jwt-cert.pem`.
- Save. Then, on the app's **Policies** tab, edit the OAuth policies:
  - **Permitted Users: Admin approved users are pre-authorized.**
  - IP relaxation: **Relax IP restrictions**, since CI runs from GitHub's addresses.
  - Under **App Policies**, select the permission set from step 3 (or the user's profile).
- On the **Settings** tab, **Consumer Key and Secret**: copy the consumer key. That's `SF_CLIENT_ID`. The secret isn't used.

A new app can take a few minutes before its token endpoint accepts it.

In an org that still allows connected apps, a connected app works the same way: App Manager > New Connected App, **Enable OAuth Settings**, **Use digital signatures** with the certificate, the same scopes; then **Manage** > **Edit Policies** > "Admin approved users are pre-authorized", and add the profile or permission set under **Manage Profiles** / **Manage Permission Sets**.

## 3. Pre-authorize the user

The JWT bearer flow has no consent screen, so the user must be pre-authorized:

1. Setup > **Permission Sets** > New: `Apex Debugger e2e`.
2. Select it in the app's policies (step 2).
3. Assign it to the e2e user (`SF_USER`).

The user also needs what the flow itself uses: API Enabled, View Setup and Configuration, Author Apex (anonymous Apex), and permission to manage users' debug logs (as before with SOAP login).

## 4. Configure

Locally, in `.env.local` (see `.env.example`):

```bash
SF_USER=e2e-user@example.com
SF_CLIENT_ID=3MVG9...
SF_JWT_KEY_FILE=sf-jwt-key.pem
# Sandboxes: https://test.salesforce.com, or the org's My Domain URL.
SF_LOGIN_URL=
```

`SF_JWT_KEY_FILE` is relative to the repository root. Instead of a file, `SF_JWT_KEY` can hold the PEM itself (newlines written as `\n`, or the whole PEM base64-encoded). The assertion's audience is `https://test.salesforce.com` when `SF_LOGIN_URL` is `test.salesforce.com` or a `*.sandbox.my.salesforce.com` My Domain, `https://login.salesforce.com` otherwise; `SF_JWT_AUDIENCE` overrides it. A second org uses the same keys with `_2` (`SF_USER_2`, `SF_CLIENT_ID_2`, `SF_JWT_KEY_FILE_2` or `SF_JWT_KEY_2`, `SF_LOGIN_URL_2`).

For GitHub Actions (`.github/workflows/e2e.yml`), set the repository secrets:

```bash
gh secret set SF_CLIENT_ID --body '3MVG9...'
gh secret set SF_JWT_KEY < sf-jwt-key.pem
# SF_USER and SF_LOGIN_URL as before; for the second org SF_CLIENT_ID_2 and SF_JWT_KEY_2.
```

## 5. Check

Without spending more than one API request (the daily-limit check), from the repository root:

```bash
node -e "import('./scripts/lib/sf-auth.mjs').then(m => m.login()).then(s => console.log('Logged in to', s.instance, 'as', s.userId))"
```

Don't print the session id. Then run the e2e flow once (`cd e2e && npm test`) and, when it passes in CI too, delete the `SF_PASS`/`SF_TOKEN` secrets and lines.

## Errors

| Message                                                    | Cause                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `user hasn't approved this consumer`                       | The user isn't pre-authorized: the policy isn't "Admin approved users are pre-authorized", or the permission set is missing. |
| `client identifier invalid`                                | `SF_CLIENT_ID` is wrong, or the app is new and not available yet.                                                           |
| `invalid assertion` / signature errors                     | The key doesn't belong to the uploaded certificate, or the computer's clock is off by minutes.                             |
| `audience is invalid`                                      | A sandbox logged in with `login.salesforce.com`: set `SF_LOGIN_URL` (or `SF_JWT_AUDIENCE`) to `https://test.salesforce.com`. |
| The test browser lands on a login page after `frontdoor.jsp` | The app lacks the `web` scope.                                                                                              |

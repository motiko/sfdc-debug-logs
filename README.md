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
  * Improved view of logs, with the same color palettes in the log viewer and on Salesforce's log page: Light, Dark, Monokai and High contrast, following your light or dark mode.
  * Log summary in the log viewer: governor limits per namespace, exceptions and fatal errors, SOQL queries (count, rows, time, likely queries in loops) and DML by operation and object; click an entry to jump to its line. It opens by itself for a failed run.
  * Click any Id to go to Object (Class, Trigger, Validation Rule e.t.c).
  * Indent User Debug (sObject, List, XML or JSON)
  * Call tree and timeline of a log: code units, methods, SOQL, DML, callouts and flows nested as they ran, with total and own time and SOQL/DML counts; choose one to go to its line.
  * Download the open log as a `.log` file (the full raw log, named by start time, operation and Id) for offline analyzers or tickets.
  * Delete logs: only yours, or all users', always confirmed with the count.
  * Start, extend or stop logging (a 24-hour trace flag for the current user).
  * Trace flags: see the org's active trace flags with their expiry and stop them; trace yourself, another user (found by name), the Automated Process user or an Apex class or trigger, with the extension's debug level, one of the org's, or custom levels per category (presets Default, Apex FINEST, Quiet), for 30 minutes up to 24 hours.
  * Customizable keyboard shortcuts for Salesforce

Keyboard Shortcuts
------------------

On Salesforce pages (while no field has focus):

* _Shift+W_ - Open the Apex Debugger log viewer
* _Shift+L_ - Open the newest debug log
* _Shift+D_ - Debug Logs
* _Shift+O_ - Custom Objects
* _Shift+U_ - Manage Users
* _Shift+P_ - Profiles
* _Shift+C_ - Apex Classes (see all)
* _Shift+T_ - Triggers (see all)
* _Shift+Q_ / _Shift+Z_ - Outbound / Inbound Change Sets
* _Shift+S_ - Schema Builder
* _Shift+E_ - Edit (clicks the page's Edit button)
* _Ctrl+S_ (_Cmd+S_ on macOS) - Save (clicks the page's Save button; works in a field too)

Hold Alt to open a page in the same tab (e.g. _Alt+Shift+D_).

Since 0.9, Edit and Save need a modifier: earlier versions used the bare _e_ and _s_ keys, which a stray key press could trigger. The classic debug log list has no delete key any more; "Delete logs…" always asks, with the scope (only your logs, or all users') and the count.

Change, add or remove shortcuts, or turn them off, on the extension's options page (click the toolbar icon, or press _?_ in the log viewer for the full list). Shortcuts you customized in earlier versions are kept; if one of yours used L or E, it keeps the key and the new built-in shortcut starts turned off.

The log viewer has its own keys (press _?_ there), and the classic debug log pages have a few single-letter keys that only change the view (listed under "Shortcuts" on the page).

Quick Demo
-----------------

[![Basic usage demo   ](https://img.youtube.com/vi/4PaQhY6tSDk/0.jpg)](https://www.youtube.com/watch?v=4PaQhY6tSDk)

[![ Last log, Search, Indent, Auto Refresh, Edit   ](https://img.youtube.com/vi/FuoA07dxEGI/0.jpg)](https://www.youtube.com/watch?v=FuoA07dxEGI)

Standalone User Scripts (Not updated)
-----------------------------

GreaseMonkey scripts on [openuserjs](https://openuserjs.org/users/motiko/scripts)

Development
-----------------------------

The extension lives in `chrome/app`. Its scripts (service worker, content scripts, options page and the React log viewer) are TypeScript and JavaScript sources in `react/src`, built with Vite into `chrome/app/js/build/` (not committed). Build them before loading `chrome/app` as an unpacked extension:

```bash
./build.sh           # installs dependencies if needed, then builds
./build.sh --watch   # rebuild on every save
./build.sh --zip     # build and package chrome/app as apex-debugger.zip
```

Before a pull request, run the checks that CI runs (Node 24, see `.nvmrc`):

```bash
cd react
npm run lint && npm run format:check && npm run typecheck && npm test
```

The end-to-end flow also runs offline, against a mock Salesforce org (no credentials, no API requests): `cd e2e && npm install && npm run test:mock`. Against a real org (`.env.local`, logging in with the OAuth 2.0 JWT bearer flow: see [docs/e2e-jwt-setup.md](docs/e2e-jwt-setup.md)), `npm test`.

`scripts/chrome-dev.sh` builds the app if needed and starts a test Chrome with the extension loaded.

Releasing
-----------------------------

```sh
git checkout main && git pull
scripts/version.sh minor    # or patch / major: bumps chrome/app/manifest.json, commits, tags vX.Y.Z
git push --follow-tags
```

Pushing the tag runs the [release workflow](.github/workflows/release.yml):

1. It checks that the tag matches the version in `chrome/app/manifest.json`.
2. It builds the extension scripts, zips `chrome/app` and creates a GitHub release with generated notes and `apex-debugger-vX.Y.Z.zip` attached.
3. It uploads the zip to the Chrome Web Store and submits it for review ([`publish-chrome-web-store.yml`](.github/workflows/publish-chrome-web-store.yml)). The new version goes live automatically once the review passes.

The Chrome Web Store accepts no new upload while the previous version is still in review, so step 3 fails in that case. The GitHub release is created anyway. After the review finishes, publish the existing release again:

```sh
gh workflow run publish-chrome-web-store.yml -f tag=vX.Y.Z
```

The same command retries any other failed upload. Check the review state in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

**New permissions:** if the release adds a permission to `chrome/app/manifest.json`, first add its justification in the dashboard (the item's **Privacy** tab). Otherwise the upload succeeds but submitting for review fails with `400 INVALID_ITEM_METADATA`. In that case, fill in the missing fields and click **Submit for review** in the dashboard. Don't rerun the workflow: the version is already uploaded, and the store rejects the same version twice.

If the Chrome Web Store isn't configured (see [Chrome Web Store publishing setup](docs/chrome-web-store-publishing.md)), step 3 is skipped with a warning, and you upload the zip from the GitHub release in the dashboard by hand.

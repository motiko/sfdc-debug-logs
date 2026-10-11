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

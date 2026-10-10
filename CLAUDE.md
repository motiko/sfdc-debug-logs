# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Apex Debugger": a Chrome/Firefox browser extension (Manifest V2) for viewing and searching Salesforce Apex debug logs, plus keyboard shortcuts for Salesforce setup pages.

## Repository layout

- `chrome/app/` and `firefox/app/`: the two unpacked extensions. Each has its own `manifest.json`, content scripts, background script, options page and CSS. **They are maintained as separate copies, not generated from a shared source**, and have drifted apart. For example, Chrome bundles `browser-polyfill` and reads `sid` from the cookie or storage in `utils.js`; Firefox has GA event hooks; the `background.js` files differ slightly. A fix to extension code usually needs to go into both trees by hand. Run `diff -r chrome/app firefox/app` to check.
- `react/`: source for the full-page log viewer (`html/app.html`). This is the only part of the repo with a build step.
- `monkey/`: older standalone Greasemonkey user scripts. The README says these are no longer updated.
- `msg_watch/`: shell scripts that poll the feedback backend (`adbg.herokuapp.com/messages`). These are dev utilities, not part of the extension.

## Build commands (run in `react/`)

```bash
npm run build:chrome   # unminified dev bundle, Chrome only (~2s)
npm run watch:chrome   # rebuild on change, Chrome only
npm run chrome         # launch test Chrome with chrome/app loaded (see below)
npm run build          # production bundle (browserify + babelify + uglify), written to BOTH chrome/ and firefox/ js/build/app.js
npm run watch          # watchify dev build, also writes to both targets
npm test               # runs `standard` (lint only; there are no unit tests)
```

`js/build/` is gitignored, so you must build before loading an unpacked extension. The toolchain is old (Babel 6, browserify, material-ui 1.0 beta, React 16, react-router 4, Redux 3). Keep to those APIs rather than modern equivalents. `material-ui` is pinned to exactly `1.0.0-beta.38`: later betas need `@babel/runtime` and break the Babel 6 build, and the `material-ui-color-picker` fork needs at least beta.38. In beta.38 the `color="contrast"` prop is gone; use `color="inherit"`.

## Local Chrome testing

`scripts/chrome-dev.sh [url]` (or `npm run chrome`) launches an isolated browser with the unpacked `chrome/app` extension. Regular Chrome 137+ ignores `--load-extension` and won't run Manifest V2, so the script downloads **Chrome for Testing 138** into `.chrome-test/` (gitignored) and re-enables MV2 with `--disable-features`. The profile in `.chrome-test/profile` persists, so a Salesforce login survives restarts. The DevTools protocol is on port 9222 (override with `CDP_PORT`).

- After changing content or background scripts, reload the extension on `chrome://extensions`. React changes only need a page reload after `watch:chrome` rebuilds.
- Without an org, the React app still renders if you open `chrome-extension://<id>/html/app.html?oid=..&uid=..&sid=..&host=..` with dummy values (API calls fail). The extension id is shown on `chrome://extensions`. Formatting follows `react/.prettierrc` (no semicolons, single quotes). The root `.eslintrc` is a legacy config for the plain extension scripts.

## Architecture

**Content scripts** (plain ES, no bundler, loaded per URL pattern in `manifest.json`):
- `shortcuts.js`: runs on all Salesforce pages. It injects a page script (`inject()` in `utils.js`) to read `window.SFDCSessionVars` from the page context. The result comes back via `window.postMessage`, and the script then sends `updateVars` (org id, user id, session id) to the background. It binds Mousetrap shortcuts from `browser.storage.sync` (`shortcuts`, with `default_shortcuts.js` as fallback). Shift+W opens the React app.
- `sfdc.debug.js`: enhances the classic single-log detail page (search, beautify/indent, themes).
- `sfdc.debug.btn.js`: adds buttons to the debug-log list page (`listApexTraces.apexp`).
- `sfdc.classes.js`: helpers on class and trigger pages.

**Background script** (`background.js`): a message router keyed on `request.command` (`openTab`, `openOrFocusTab`, `focusAppTab`, `updateVars`, `getVars`). It tracks open app tabs in `appTabIds` (one `app_<orgId>` tab per org) and stores per-org session vars and `sid` in `orgVars`.

**React app** (`react/src/`, opened as `html/app.html?oid=&uid=&sid=&host=`):
- `global-sf.js` builds one `SF` client from the URL query params. That client is injected into every thunk as the extra argument (`thunk.withExtraArgument(globalSf)`), so action creators get it as the third parameter: `(dispatch, getState, sf)`.
- `api/sf.js` wraps `api/tooling.js` (Tooling API: ApexLog queries, log bodies, TraceFlag and DebugLevel creation) and `api/batch.js` (Bulk API, used for "delete all logs").
- `api/request.js` is a fetch wrapper with a Bearer token. On a 401 it retries and fetches a fresh `sid` from the background script via `getVars`. This is how the app survives Salesforce session refresh.
- Redux state is `{ logsPage, feedbackPage }`. Some `logsPage` keys (`maxLogs`, `sideLogsOpen`, `styleConfig`, `visibleEvents`) are persisted to **sessionStorage** via `redux-localstorage` (see `app.js`). Log bodies are cached in IndexedDB via `idb-keyval`.
- Routes (HashRouter): `/logs` (default) and `/feedback`. The feedback page talks to `https://adbg.herokuapp.com`.
- `react/mocks/` holds sample API responses and logs for manual testing.

## Releasing

Bump `version` in both `chrome/app/manifest.json` and `firefox/app/manifest.json`. Any new remote host the app calls must be added to the manifest `content_security_policy` `connect-src` and to `permissions`.

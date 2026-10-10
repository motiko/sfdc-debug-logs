# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Apex Debugger": a Chrome extension (Manifest V3) for viewing and searching Salesforce Apex debug logs, plus keyboard shortcuts for Salesforce setup pages.

## Repository layout

- `chrome/app/`: the unpacked extension (`manifest.json`, service worker, content scripts, options page, CSS). Plain JS, no bundler.
- `react/`: source for the full-page log viewer (`html/app.html`). The only part with a build step. Its output, `chrome/app/js/build/app.js`, **is committed**, so rebuild and commit it together with React source changes.
- `scripts/`: local dev tooling (test browser launcher, Salesforce login).
- `e2e/`: end-to-end flow against a real org (see below).

## Build commands (run in `react/`)

```bash
npm run build   # production bundle (browserify + babelify + uglify) -> chrome/app/js/build/app.js
npm run watch   # watchify dev build to the same file
npm test        # runs `standard` (lint only; there are no unit tests)
```

The toolchain is Babel 7 with browserify, on old libraries (material-ui `1.0.0-beta.38` pinned exactly, React 16, react-router 4, Redux 3). Keep to those APIs rather than modern equivalents. In material-ui beta.38 the `color="contrast"` prop no longer exists; use `color="inherit"`. Use `material-ui-icons` for icons, not `@material-ui/icons`: the latter pulls in `@material-ui/core`, a second JSS instance whose generated class names collide with material-ui's and break layouts. Formatting follows `react/.prettierrc` (no semicolons, single quotes).

## Local Chrome testing

`scripts/chrome-dev.sh [url]` launches an isolated browser with the unpacked `chrome/app` extension. Branded Chrome 137+ ignores `--load-extension`, so the script downloads **Chrome for Testing** (stable) into `.chrome-test/` (gitignored). The profile in `.chrome-test/profile` persists. The DevTools protocol is on port 9222 (override with `CDP_PORT`).

- **Auto-login:** if `.env.local` exists (gitignored; keys in `.env.example`: `SF_USER`, `SF_PASS`, `SF_TOKEN`, optional `SF_LOGIN_URL`) and no URL argument is given, Chrome starts blank and `scripts/sf-login.mjs` logs in via SOAP `login()` + `frontdoor.jsp`, landing on the Debug Logs page. The session id goes over CDP, not the command line. Rerun it against a running browser with `node scripts/sf-login.mjs [retURL]`.
- After changing content scripts or the service worker, reload the extension on `chrome://extensions`. React changes need a rebuild and a page reload.
- **Session token:** the `sid` cookie is HttpOnly on current Salesforce, so content scripts can't read it. `getToken()` in `utils.js` falls back to the token saved on the options page (`chrome.storage.local.token`, served by the service worker's `getToken` message). Without it, API calls from content scripts fail. The e2e flow seeds this token.

## End-to-end flow (`e2e/`)

`cd e2e && npm install && npm test` rebuilds the React bundle, then runs `apex-logs.test.mjs` (`node --test` + `puppeteer-core`, headless Chrome for Testing, throwaway profile; `HEADFUL=1` to watch). It logs in with `.env.local` (or `SF_ACCESS_TOKEN` + `SF_INSTANCE_URL`), makes sure the user has a trace flag (`ApexDbgrExtension` debug level, like the app), runs anonymous Apex with a unique marker, and finds the resulting ApexLog. It then checks both views:
- **Classic** (`/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=…`, `sfdc.debug.js`): marker visible and findable, every theme in `debug.css` applied to every event class, font size.
- **React app** (opened with Shift+W): log listed, search filters to the marker's log, log body visible, theme menu opens on click, every theme in `constants.js` colors every line by its category, custom color, font size, text wrap.

Expected styles are read from `debug.css` and `constants.js`, so new themes are covered automatically. Shared login code lives in `scripts/lib/sf-auth.mjs`. Page errors are reported as test diagnostics, not failures.

CI: `.github/workflows/e2e.yml` runs the flow on pushes to `main`, same-repo pull requests and manual dispatch, using repository secrets `SF_USER`, `SF_PASS`, `SF_TOKEN` and optional `SF_LOGIN_URL`. Runs are serialized because they share one org. In CI (`CI` set) Chrome starts with `--no-sandbox`.

## Architecture

**Content scripts** (loaded per URL pattern in `manifest.json`):
- `shortcuts.js` (all Salesforce pages, with `utils.js`, `default_shortcuts.js`, Mousetrap): binds shortcuts from `chrome.storage.sync` (`shortcuts`, fetched via the service worker). Shift+W opens the React app with `oid`/`uid` from the `disco` cookie and the session token in the URL.
- `sfdc.debug.js`: enhances the classic single-log detail page (beautify/indent, themes, font size, ID links).
- `sfdc.debug.btn.js`: adds buttons to the debug-log list page (`listApexTraces.apexp`).
- `sfdc.classes.js`: helpers on class and trigger pages.

**Service worker** (`background.js`): a message router keyed on `request.command` (`getToken`, `getShortcuts`, `openTab`, `openOrFocusTab`, `focusAppTab`, `updateVars`, `getVars`). Tab ids for the options and app tabs are kept in `chrome.storage.sync`, since the worker's memory doesn't persist.

**React app** (`react/src/`, opened as `html/app.html?oid=&uid=&sid=&host=`):
- `global-sf.js` builds one `SF` client from the URL query params. That client is injected into every thunk as the extra argument (`thunk.withExtraArgument(globalSf)`), so action creators get it as the third parameter: `(dispatch, getState, sf)`.
- `api/sf.js` wraps `api/tooling.js` (Tooling API: ApexLog queries, log bodies, TraceFlag and DebugLevel creation) and `api/batch.js` (Bulk API, used for "delete all logs"). `api/request.js` is a fetch wrapper with a Bearer token from the `sid` URL param.
- Redux state is `{ logsPage, feedbackPage }`. Some `logsPage` keys (`maxLogs`, `sideLogsOpen`, `styleConfig`, `visibleEvents`) are persisted to **sessionStorage** via `redux-localstorage` (see `app.js`). Log bodies are cached in IndexedDB via `idb-keyval`.
- Log line styling: `parsed-log.js` maps each event to a category with `logEventToType` and colors it with `styleConfig.theme[category]` (themes in `pages/logs/constants.js`).

## Releasing

See "Releasing" in README.md. `scripts/version.sh patch|minor|major` bumps `chrome/app/manifest.json` (the source of truth for the version), commits and tags `vX.Y.Z`; `git push --follow-tags` runs `.github/workflows/release.yml`, which builds, zips `chrome/app`, creates a GitHub release and calls `publish-chrome-web-store.yml` (Chrome Web Store API v2, keyless auth via workload identity federation, set up as in `docs/chrome-web-store-publishing.md`). Retry a failed upload with `gh workflow run publish-chrome-web-store.yml -f tag=vX.Y.Z`. Any new remote host the app calls must be added to `content_security_policy.extension_pages` `connect-src` and to `host_permissions`.

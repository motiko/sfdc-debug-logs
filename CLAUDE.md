# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Apex Debugger": a Chrome extension (Manifest V3) for viewing and searching Salesforce Apex debug logs, plus keyboard shortcuts for Salesforce setup pages.

## Repository layout

- `chrome/app/`: the unpacked extension: `manifest.json`, HTML pages (`html/app.html`, `html/options.html`), CSS and images. Its scripts are built from `react/` into `chrome/app/js/build/`.
- `react/`: the single npm package and the source of every script (`react/src`):
  - `src/extension/`: one entry per extension script: `background.ts` (service worker), `shortcuts.ts` (all Salesforce pages), `debug-log-page.ts` (classic log page), `debug-log-list.ts` (classic log list), `class-page.ts` (class and trigger lists), `options.ts` (options page).
  - `src/core/`: modules shared by the entries: `page-session.ts` (cookies, session, `sfRequest`, API paths, the open-app message), `org-hosts.ts` (`isOrgHost`, `apiHostFor`), `default-shortcuts.ts`.
  - `src/app.js` and the rest of `src/`: the full-page log viewer (`html/app.html`).
- The build output, `chrome/app/js/build/*.js` and `app.css`, is **not committed** (gitignored): run `./build.sh` (installs dependencies if needed; `--watch` rebuilds on save, `--zip` packages `chrome/app`) before loading `chrome/app` unpacked.
- `scripts/`: local dev tooling (test browser launcher, Salesforce login).
- `e2e/`: end-to-end flow against a real org (see below).

## Build and check commands (run in `react/`)

Use Node 24 (`.nvmrc`).

```bash
npm run build         # build.mjs: one Vite build per entry -> chrome/app/js/build/<entry>.js (+ app.css)
npm run dev           # build.mjs --watch: rebuilds on save, then reload the page or the extension
npm run lint          # ESLint 9 over the whole repository (.js/.mjs in react/, e2e, scripts)
npm run format        # Prettier 3: react/src, e2e, scripts (format:check in CI)
npm run typecheck     # tsc --noEmit
npm test              # Vitest unit tests (vitest run); npx vitest to watch
```

`.github/workflows/ci.yml` runs lint, format:check, typecheck, unit tests and build on pushes to `main` and on pull requests (no Salesforce secrets needed).

The toolchain is Vite (`react/vite.config.mjs`) plus TypeScript for type checking only (`tsconfig.json`, `allowJs`, not strict, `@types/chrome`); new files should be `.ts`. `entries` in `vite.config.mjs` lists every script; `build.mjs` runs one build per entry, because content scripts must be classic scripts and Rolldown's IIFE output takes a single input. So each output is one self-contained classic IIFE (`app` also emits `app.css`) with its own copy of whatever it imports, and it satisfies the extension CSP (`script-src 'self'`: no inline scripts, no eval, no code splitting). `build.mjs` empties `js/build/` first and fails if a script that `manifest.json` loads wasn't built. A new script needs an entry in `entries` and a reference in `manifest.json` or an HTML page. Share code by importing from `src/core`, never through globals. Content scripts write log and org data into Salesforce pages: build such DOM with `textContent` and elements, never `innerHTML` (log text can come from public Sites). Sources keep JSX in `.js` files; a small plugin in `vite.config.mjs` compiles it. Don't use decorators: wrap components explicitly, e.g. `export default withStyles(styles)(connect(mapState, mapDispatch)(X))`. Dependencies come from npm (`js-beautify`, `mousetrap`); nothing is vendored. The app runs on old libraries (material-ui `1.0.0-beta.38` pinned exactly, React 16, react-router 4, Redux 3). Keep to those APIs rather than modern equivalents. In material-ui beta.38 the `color="contrast"` prop no longer exists; use `color="inherit"`. Use `material-ui-icons` for icons, not `@material-ui/icons`: the latter pulls in `@material-ui/core`, a second JSS instance whose generated class names collide with material-ui's and break layouts.

**Formatting and lint.** One Prettier config at the root (`.prettierrc.json`: no semicolons, single quotes, no trailing commas, `arrowParens: avoid`; 120 columns in `e2e/` and `scripts/`). `eslint.config.js` (flat config) lives at the root but loads its plugins from `react/node_modules`, so run ESLint from `react/`. ESLint parses only `.js`/`.mjs`: typescript-eslint doesn't support TypeScript 7, so `.ts` files are checked by `tsc` only. material-ui orders its style sheets by module load order, so removing or reordering a material-ui import can change CSS precedence (see the side-effect import of `material-ui/Button` in `logs.js`).

**Unit tests** (`*.test.ts` next to the code, Node environment, config in `vite.config.mjs`): keep logic testable by putting it in plain modules, like `pages/logs/log-parsing.ts` (log splitting, event categories, id links, USER_DEBUG beautifying) and `pages/logs/utils.ts` (log filters). Fixtures such as `pages/logs/__fixtures__/anonymous-apex.log` are imported with `?raw`.

## Local Chrome testing

`scripts/chrome-dev.sh [url]` launches an isolated browser with the unpacked `chrome/app` extension. Branded Chrome 137+ ignores `--load-extension`, so the script downloads **Chrome for Testing** (stable) into `.chrome-test/` (gitignored). The profile in `.chrome-test/profile` persists. The DevTools protocol is on port 9222 (override with `CDP_PORT`).

- **Auto-login:** if `.env.local` exists (gitignored; keys in `.env.example`: `SF_USER`, `SF_PASS`, `SF_TOKEN`, optional `SF_LOGIN_URL`) and no URL argument is given, Chrome starts blank and `scripts/sf-login.mjs` logs in via SOAP `login()` + `frontdoor.jsp`, landing on the Debug Logs page. The session id goes over CDP, not the command line. Rerun it against a running browser with `node scripts/sf-login.mjs [retURL]`.
- The script builds the extension if `js/build/` is missing scripts (running `npm ci` in `react/` first if needed). After changing content scripts or the service worker, reload the extension on `chrome://extensions`. Every change needs a rebuild (or `./build.sh --watch` running) first; app changes then only need a page reload.
- **Session token:** the `sid` cookie is HttpOnly on current Salesforce, so content scripts can't read it. `getSession()` in `src/core/page-session.ts` asks the service worker (`getToken` message), whose `getSessionForUrl()` (`src/extension/background.ts`), which reads `sid` with `chrome.cookies` for the org's `my.salesforce.com` host (`apiHostFor()` maps Lightning and `salesforce-setup.com` hosts) and returns `{ token, host }`. It answers only for org hosts (`isOrgHost()`): content scripts also run on public Salesforce Sites under `*.force.com`, which must never get a session. Only if there's no cookie does it fall back to the token saved on the options page (`chrome.storage.local.token`). The React app asks the same way after a 401. The e2e flow saves no token, so it exercises the cookie path.

## End-to-end flow (`e2e/`)

`cd e2e && npm install && npm test` rebuilds the extension, then runs `apex-logs.test.mjs` (`node --test` + `puppeteer-core`, headless Chrome for Testing, throwaway profile; `HEADFUL=1` to watch). It logs in with `.env.local` (or `SF_ACCESS_TOKEN` + `SF_INSTANCE_URL`), makes sure the user has a trace flag (`ApexDbgrExtension` debug level, like the app), runs anonymous Apex with a unique marker, and finds the resulting ApexLog. It then checks both views:
- **Classic** (`/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=…`, `debug-log-page.ts`): marker visible and findable, every theme in `debug.css` applied to every event class, font size, and a debugged `<img onerror>` payload shown as text (collapsed and expanded) with no element created and no handler run.
- **React app** (opened with Shift+W): log listed, search filters to the marker's log, the operation filter reloads only matching logs, log body visible, the `<img onerror>` payload shown as text, theme menu opens on click, every theme in `constants.js` colors every line by its category, custom color, font size, text wrap.
- **Lightning:** switches the user to Lightning Experience for the test (`UserPreferencesLightningExperiencePreferred`, restored afterwards) and presses Shift+W on Lightning Home (`*.lightning.force.com`) and Lightning Setup (`*.my.salesforce-setup.com`); the app must get the `my.salesforce.com` session and list logs.

Expected styles are read from `debug.css` and `constants.js`, so new themes are covered automatically. `openAppWithShiftW()` records the messages content scripts send to the service worker: it presses Shift+W only after the page's `getShortcuts` request (when Mousetrap binds), with the tab in front and focus moved to the top document, and counts the press as handled when `focusAppTab` arrives. On failure it saves `e2e/artifacts/<name>.png/.log` (sid redacted) with the focus state, each press and the worker messages. Shared login code lives in `scripts/lib/sf-auth.mjs`. Page errors are reported as test diagnostics, not failures.

CI: `.github/workflows/e2e.yml` runs the flow on pushes to `main`, same-repo pull requests and manual dispatch, using repository secrets `SF_USER`, `SF_PASS`, `SF_TOKEN` and optional `SF_LOGIN_URL`. Runs are serialized because they share one org. In CI (`CI` set) Chrome starts with `--no-sandbox`.

## Architecture

**Content scripts** (`react/src/extension/`, loaded from `js/build/` per URL pattern in `manifest.json`):
- `shortcuts.ts` (all Salesforce pages, Mousetrap): binds shortcuts from `chrome.storage.sync` (`shortcuts`, fetched via the service worker; defaults in `core/default-shortcuts.ts`). Shift+W opens the React app with `oid`/`uid` from the `disco` cookie and the session token in the URL.
- `debug-log-page.ts`: enhances the classic single-log detail page (beautify/indent, themes in `css/debug.css`, font size, ID links).
- `debug-log-list.ts`: adds buttons, search and hotkeys to the debug-log list page (`listApexTraces.apexp`), and opens the app for `?openApp=yes`. It binds its hotkeys on its own Mousetrap instance, next to the one in `shortcuts.ts`.
- `class-page.ts`: helpers on class and trigger pages.

**Service worker** (`background.ts`): a message router keyed on `request.command` (`getToken`, `getShortcuts`, `openTab`, `openOrFocusTab`, `focusAppTab`). Tab ids for the options and app tabs are kept in `chrome.storage.sync`, since the worker's memory doesn't persist. It exposes `self.getSessionForUrl` for the e2e flow.

**Options page** (`options.ts`, `html/options.html`): edits the shortcuts and the saved session id.

**React app** (`react/src/`, opened as `html/app.html?oid=&uid=&sid=&host=`):
- `global-sf.js` builds one `SF` client from the URL query params. That client is injected into every thunk as the extra argument (`thunk.withExtraArgument(globalSf)`), so action creators get it as the third parameter: `(dispatch, getState, sf)`.
- `api/sf.js` wraps `api/tooling.js` (Tooling API: ApexLog queries, log bodies, TraceFlag and DebugLevel creation) and `api/batch.js` (Bulk API, used for "delete all logs"). `api/request.js` is a fetch wrapper with a Bearer token from the `sid` URL param.
- Redux state is `{ logsPage, feedbackPage }`. Some `logsPage` keys (`maxLogs`, `sideLogsOpen`, `styleConfig`, `visibleEvents`) are persisted to **sessionStorage** via `redux-localstorage` (see `app.js`). Log bodies are cached in IndexedDB via `idb-keyval`.
- Log line styling: `parsed-log.js` maps each event to a category with `logEventToType` and colors it with `styleConfig.theme[category]` (themes in `pages/logs/constants.js`).

## Releasing

See "Releasing" in README.md. `scripts/version.sh patch|minor|major` bumps `chrome/app/manifest.json` (the source of truth for the version), commits and tags `vX.Y.Z`; `git push --follow-tags` runs `.github/workflows/release.yml`, which builds every script (they are not committed), zips `chrome/app` (no source maps), creates a GitHub release and calls `publish-chrome-web-store.yml` (Chrome Web Store API v2, keyless auth via workload identity federation, set up as in `docs/chrome-web-store-publishing.md`). Retry a failed upload with `gh workflow run publish-chrome-web-store.yml -f tag=vX.Y.Z`. The Salesforce API version is set in two places, kept equal: `react/src/api/version.ts` (app and content scripts) and `API_VERSION` in `scripts/lib/sf-auth.mjs` (e2e). Any new remote host the app calls must be added to `content_security_policy.extension_pages` `connect-src` and to `host_permissions`.

## Claude tooling

- `.claude/skills/verify-extension`: build, lint, typecheck, unit tests and the e2e flow before committing.
- `.claude/skills/triage-reports`: check GitHub issues and Chrome Web Store reviews against the code.
- `.claude/skills/release-extension`: readiness checks, tagging, and watching the release and store upload.
- `.claude/agents/market-research`: compares competing extensions and files feature requests (labels `enhancement`, `market-research`).

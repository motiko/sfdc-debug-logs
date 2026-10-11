---
name: verify-extension
description: Verify a change to the Apex Debugger extension before committing or opening a PR. Builds the extension scripts, runs lint, format check, typecheck, unit tests and the end-to-end flow against the real Salesforce org, and explains how to debug failures. Use after any change to chrome/app, react/, e2e/ or scripts/.
---

# Verify an Apex Debugger change

Run the steps in order and stop at the first failure. Report what ran and what failed, with output.

## 1. Build

```sh
npm --prefix react run build
```

The output in `chrome/app/js/build/` is gitignored; don't commit it (see CLAUDE.md).

## 2. Lint, format, typecheck, unit tests

```sh
cd react && npm run lint && npm run format:check && npm run typecheck && npm test
```

The same checks run in CI (`.github/workflows/ci.yml`). If `format:check` fails, run `npm run format` and review the diff. ESLint covers the `.js`/`.mjs` files in `react/`, `e2e/` and `scripts/`; `.ts` files (including every extension script in `react/src/extension` and `react/src/core`) are only type-checked. Unit tests (Vitest) live next to the code as `*.test.ts`; add or update them when changing log parsing, themes, filters, search or Salesforce calls (`core/salesforce/client.test.ts` uses a fake request function).

## 3. End-to-end flow, offline first

Run the flow against the mock org first (no credentials, no Salesforce API requests; the same job runs in CI):

```sh
cd e2e && npm install && npm run test:harness && npm run test:mock
```

UI changes: `npm run ux-audit -- --mock --out <dir>` captures every view with axe-core and the other checks against the mock org; look at the screenshots and the `serious`/`critical` axe counts in `summary.json`. The mock is in `e2e/mock/` (see CLAUDE.md); if a change needs an API call or a page shape the mock doesn't have, extend the mock in the same change.

Then confirm against the real org (each run costs roughly 50 API requests of the org's daily limit, printed at the end; if Salesforce answers `REQUEST_LIMIT_EXCEEDED`, stop and don't retry in a loop, even login fails until the limit resets).

Needs `.env.local` (SF_USER, SF_PASS, SF_TOKEN, optional SF_LOGIN_URL). Never print its values or session ids.

```sh
cd e2e && npm install && npm test
```

This rebuilds the bundle, logs into the org, runs anonymous Apex and checks the classic log page and the React app (visibility, search, every theme of `core/log/themes.ts` in both views, font size, wrap, the virtualized rendering of a long log).
- After changing the log body rendering (`parsed-log.js`, `core/log/parsing.ts`), also run `node large-log-perf.mjs` in `e2e/`: it creates a ~20 MB log and prints the time to the first rendered line and the scroll step times (compare with `--ext <dir>` pointing at a build of `main`).
- Watch it run with `HEADFUL=1 npm test`.
- Only one run at a time: CI and local runs share the org's trace flag.

On failure:
- `e2e/artifacts/` holds a screenshot and a log for the step that failed (for example `shift-w.png` and `shift-w.log`). Read both. The logs have the sid redacted.
- Page errors appear as test diagnostics (`# page error: …`). They don't fail a test on their own, but they are often the cause.
- If the failure is a timeout right after login, rerun once. A run started while the org was busy is the most common cause of timeouts.

## 4. Manual smoke (UI changes)

```sh
scripts/chrome-dev.sh
```

This opens Chrome for Testing logged into the org, on the Debug Logs page. Check the screens the change touches:
- log list buttons (the e2e flow doesn't press Delete All or Add Current User; check them after changing `core/salesforce`. Delete All removes every log in the org, so rerun the e2e flow afterwards)
- classic log page (open a log)
- Shift+W app
- class page (`/01p…`): the Dont Log Class checkbox sets or removes a CLASS_TRACING flag
- options page

After changing a content script or the service worker, reload the extension on `chrome://extensions`. The DevTools protocol is on port 9222, so the chrome-devtools MCP tools can drive this browser.

## 5. Report

List the steps that passed, anything skipped and why, and the failing output, if any. Don't claim a check passed if it didn't run.

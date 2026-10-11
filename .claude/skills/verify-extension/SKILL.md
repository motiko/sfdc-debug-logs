---
name: verify-extension
description: Verify a change to the Apex Debugger extension before committing or opening a PR. Builds the React bundle, runs lint and the end-to-end flow against the real Salesforce org, and explains how to debug failures. Use after any change to chrome/app, react/, e2e/ or scripts/.
---

# Verify an Apex Debugger change

Run the steps in order and stop at the first failure. Report what ran and what failed, with output.

## 1. Build

```sh
npm --prefix react run build
```

If a React source file changed, `chrome/app/js/build/app.js` must change too and be committed with it (see CLAUDE.md).

## 2. Lint

Run the lint and typecheck scripts that exist in `react/package.json`; check the `scripts` section, since the tooling is being modernized. Until ESLint/TypeScript land, check formatting of changed React files with:

```sh
cd react && npx prettier --check <changed files>
```

## 3. End-to-end flow

Needs `.env.local` (SF_USER, SF_PASS, SF_TOKEN, optional SF_LOGIN_URL). Never print its values or session ids.

```sh
cd e2e && npm install && npm test
```

This rebuilds the bundle, logs into the org, runs anonymous Apex and checks the classic log page and the React app (visibility, search, every theme, font size, wrap).
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
- log list buttons
- classic log page (open a log)
- Shift+W app
- class page (`/01p…`)
- options page

After changing a content script or the service worker, reload the extension on `chrome://extensions`. The DevTools protocol is on port 9222, so the chrome-devtools MCP tools can drive this browser.

## 5. Report

List the steps that passed, anything skipped and why, and the failing output, if any. Don't claim a check passed if it didn't run.

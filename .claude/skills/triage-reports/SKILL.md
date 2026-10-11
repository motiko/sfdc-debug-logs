---
name: triage-reports
description: Triage Apex Debugger bug reports from GitHub issues and Chrome Web Store reviews. Checks each report against the current code, labels and comments on issues, and proposes fixes. Use before planning a release or when asked to check reported bugs.
---

# Triage reported bugs

## 1. Collect reports

- **GitHub:** `gh issue list -R motiko/sfdc-debug-logs --state open --limit 100`, then `gh issue view <n> -R motiko/sfdc-debug-logs --comments` for each issue that isn't a feature request.
- **Reviews:** the Chrome Web Store often redirects to a consent page, so read the mirrors:
  - `https://extscope.org/extension/mpckkbblhbfngaininanfjpdfjhbncjo`
  - `https://chromeboard.com/extension/apex-debugger-mpckkbblhbfngaininanfjpdfjhbncjo`

  Keep reviews newer than the last release (`gh release list -R motiko/sfdc-debug-logs`) or the last triage. Mirror star ratings can be wrong; go by the text.
- **Your own notes:** if earlier triage results exist (issue comments labeled by you), skip anything already handled.

## 2. Check each report against `main`

For each report:
- Find the code path: `chrome/app/js/*` for classic pages, shortcuts and the service worker; `react/src/**` for the Shift+W app; `manifest.json` for domains and permissions.
- Decide: **still a bug** (with a file:line cause), **fixed** (name the commit or PR), **needs info**, or **not a bug / feature request**.
- If you can, reproduce it with the e2e setup (`scripts/chrome-dev.sh` with `.env.local`, or a focused check in `e2e/`). Don't print credentials or session ids.

## 3. Act on GitHub

Only on `motiko/sfdc-debug-logs`, and only for clear-cut cases:
- **Still a bug:** add the `bug` label, and a comment with the cause (file:line) and the proposed fix and size (S/M/L).
- **Fixed:** comment with the PR or commit that fixed it and the release it shipped in, then close it. If it isn't released yet, comment only.
- **Needs info:** comment with the exact information needed (console output, org type, URL pattern).
- **Feature request:** add the `enhancement` label.

Reviews can't be answered from here. Turn a review that reports a real, new bug into a GitHub issue: paraphrase it, leave out the reviewer's name, and link the mirror page.

## 4. Report

Give a table with: report (issue # or review date), status, cause (file:line), proposed fix, size, and the action you took. Then list the fixes you recommend for the next patch release, smallest first.

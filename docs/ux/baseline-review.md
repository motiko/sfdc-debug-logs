# Baseline UX/UI review (before the React 19 / MUI v6 redesign)

Reviewed: extension 0.8.3 (`main` at `30f674c`), React 16 + material-ui `1.0.0-beta.38` log viewer, the classic Salesforce page enhancements (content scripts) and the options page.
Date: 2026-10-11. Method: `.claude/agents/ux-ui-review.md`.

The findings here are meant to drive the redesign, so they describe the problem and the expected behavior, not patches to the current code. No GitHub issues were filed for this baseline.

## How this was produced

- `e2e/ux-audit.mjs` (run with `cd e2e && npm run ux-audit`) logs in to the dev org, makes sure logging is on and runs anonymous Apex that produces a realistic log (222 lines: plain-text, JSON and SObject-list `USER_DEBUG`s, two SOQL queries, two caught exceptions, a 150-iteration loop). It also runs a second block that fails with an uncaught exception.
- It captured 66 states, at 1440×900 and 1024×768, in Chrome for Testing with the unpacked extension:
  - App (`html/app.html`, opened with Shift+W): list, loading, unreachable org, search with results and with none, filter dialog and its menu, style dialog, an open log in each theme (top and scrolled), expanded JSON, content filter, side list toggled, a failed run.
  - Classic pages: log detail in each theme (top and scrolled) and expanded, debug log list and its search, Apex class list.
  - Options page: default, after "Add New", and after Save with an invalid row.
- Each state has axe-core 4.14 results, WCAG contrast for every visible text node and form value (composited background), non-text contrast (icons and input boundaries), unnamed controls (from Chrome's accessibility tree), clickable elements that can't be focused, controls covered by other elements, text under 12px, and clipped text. On Salesforce pages only the extension's own UI is checked; Salesforce's own violations are counted separately (`hostPageViolations`).
- Keyboard: a Tab walk through each view records the order and whether each stop changes pixels when focused, plus each dialog's focus entry, trap and return.
- Every screenshot was also reviewed by eye, and the main tasks were walked through as a Salesforce developer would do them.

Artifacts are written to `e2e/ux-artifacts/`, which is gitignored, so screenshots aren't committed. The names below are relative to that directory. To reproduce them: `cd e2e && npm run ux-audit`, then compare later runs with `npm run ux-audit -- --out <new dir> --compare ux-artifacts`.

## Summary

| View | Blocker | Major | Minor | Total |
|---|---|---|---|---|
| App (React log viewer) | 5 | 11 | 11 | 27 |
| Classic pages (log detail, log list, class list) | 1 | 3 | 1 | 5 |
| Options page | 1 | 2 | 1 | 4 |
| Shared (themes, shortcuts, copy, fonts) | 0 | 2 | 3 | 5 |
| **Total** | **7** | **18** | **16** | **41** |

Automated totals for the 1440×900 run (per view, summed over states; each state checks the whole page, so numbers repeat across states):

| View (states) | axe violations | low-contrast text elements | unnamed controls | clickable, not focusable | covered controls |
|---|---|---|---|---|---|
| App (20) | 90 | 130 | 55 | 236 | 8 (23 at 1024) |
| Classic (10) | 26 | 143 | 16 | 0 | 0 |
| Options (3) | 15 | 41 | 0 | 29 | 0 |

### Top 10

1. **B1** The app silently hides logs over 2.5 MB or 12 s.
2. **B4** "Delete all logs" has no confirmation, and the bare `a` key triggers it, for every user in the org.
3. **B2** Log rows in the app list can't be reached or opened with the keyboard.
4. **B3** At 1024 px wide the app toolbar breaks: actions are cut in half and two buttons are unclickable.
5. **B5** Icon buttons and form fields in the app have no accessible name.
6. **M7** Long logs are hard to read: low density and no way to navigate structure (errors, debug lines, SOQL).
7. **M4** Search gives a one-second toast, then no trace: no highlight in the log, no persistent "filtered" state, no empty state.
8. **M5** Loading, error and empty states are missing or misleading.
9. **M2** Theme colors fail contrast on main content: Monokai "system" at 3.04:1, error red at 3.7–3.9:1 in every theme, Emacs callout at 2.72:1.
10. **M15** Shortcuts are undiscoverable, and some are risky: single-letter global hotkeys, including `s` = Save on every Salesforce page.

## Findings

Severity: **blocker** means a task can't be done, or a control can't be operated by keyboard or screen reader. **Major** covers contrast below the threshold on main content, confusing or misleading UI, and missing states. **Minor** covers inconsistencies and polish.

### Blockers

#### B1. Logs over 2.5 MB or 12 s are silently hidden in the app (blocker, App)
- **Where:** app list and log side list, every state. Compare `app-list@1440x900.png` with `classic-list-search@1440x900.png`. The classic list shows a 19,525,305-byte log at 05:20:37 PT (14:20:37 in the app's time zone). The app list jumps from 14:24:23 to 14:13:11 without it.
- **Evidence:** the filter defaults are already a filter: `length: [0, 2_500_000]` and `duration: [0, 12_000]`. `filterActiveFilters` treats any non-empty array as active, so every load sends `WHERE LogLength >= 0 AND LogLength <= 2500000 AND DurationMilliseconds >= 0 AND DurationMilliseconds <= 12000` and filters locally too. A query on the org confirmed that 1 of the newest 37 logs is excluded. Nothing in the UI says a filter is active.
- **Why it matters:** the biggest and slowest transactions (batch jobs, integrations, timeouts) are exactly the logs developers need, and the tool says they don't exist. "Find the log for something I just ran" fails with no hint.
- **Fix:** with no filter set, query nothing extra. Numeric filters become active only when the user sets them. Use real bounds (Salesforce logs go up to 20 MB, and transactions run for minutes). Show active filters as removable chips above the list (see M6).
- **Files:** `react/src/pages/logs/dialogs/filter/reducer.js`, `react/src/pages/logs/utils.ts`, `react/src/pages/logs/dialogs/filter/filter-dialog.js`.

#### B2. Log rows can't be opened with the keyboard (blocker, App)
- **Where:** `app-list@1440x900.png`, `app-keyboard-list.json`.
- **Evidence:** a Tab cycle on the list has 9 stops, all in the toolbar. None of the 36 rows is reachable. Each `<tr>` has a React `onClick` but no tabindex, role or link (`clickableNotFocusable.count` = 12–39 per list state). Screen readers announce a plain table with no way to open a row.
- **Why it matters:** the main task, opening a log, needs a mouse.
- **Fix:** make each row a link, or the time cell a link to `#/logs/<id>`. Better: give the list grid semantics with a roving tabindex, ↑/↓ to move and Enter to open. Show a visible focus state on rows.
- **Files:** `react/src/pages/logs/components/logs-table.js`.

#### B3. At 1024 px the app toolbar breaks (blocker, App)
- **Where:** `app-list@1024x768.png`, `app-log-monokai@1024x768.png`, `app-filter-dialog@1024x768.png`.
- **Evidence:** the toolbar wraps to two rows inside a fixed 64 px app bar. The Home icon is cut off at the top. Reload, filter, delete and style are cut in half at the bottom edge. The "Max Logs" label disappears. In the log view, the side-list toggle and the content-filter button sit under the app bar (`obscuredControls`: 2 per log state at 1024, covered by the toolbar's grid). They can't be clicked.
- **Why it matters:** 1024 px is a normal split-screen width next to Salesforce or an IDE. At that width the viewer's actions are partly or fully unusable.
- **Fix:** a responsive toolbar. Keep the primary actions and move the rest into an overflow menu. Let the bar grow instead of using a fixed height. Never position content controls under the bar.
- **Files:** `react/src/pages/logs/logs.js`, `react/src/pages/logs/components/log-view.js`.

#### B4. Delete all logs: no confirmation, a single-key hotkey, org-wide (blocker, App and classic list)
- **Where:** app toolbar (trash icon next to filter); classic list "Delete (A)ll"; hotkeys.
- **Evidence:**
  - The app button calls `deleteAll()` directly. It deletes every ApexLog in the org, for all users, through the Bulk API.
  - In the app, a `keyup` listener on `document.body` maps `a` to delete all whenever focus isn't in an input. One stray keypress, for example after clicking a log line, wipes the org's logs with no confirmation and no undo.
  - On the classic list, `a` asks with `confirm()` once, then stores `dontConfirmDeleteAllHotKey` and never asks again.
  - In the app, the trash icon (`DeleteForever`) looks like the neighboring icon buttons and is a Tab stop right after "Filter logs" (`app-keyboard-list.json`).
- **Why it matters:** this is irreversible data loss that also hits other developers' logs in a shared sandbox. Rated blocker even though the task itself works, because the damage is org-wide and comes from one keystroke.
- **Fix:**
  - Require confirmation in a dialog that states the scope ("Delete 1,234 logs for all users in <org>?") and lets the user choose "only mine".
  - Remove the single-key hotkey, or require a modifier plus the dialog.
  - Separate the destructive action visually and spatially from refresh and filter (an overflow menu, danger color).
  - After deleting, show "Deleted N logs".
- **Files:** `react/src/pages/logs/logs.js`, `react/src/pages/logs/actions.js`, `react/src/extension/debug-log-list.ts`.

#### B5. App controls without accessible names (blocker, App)
- **Where:** every app state. For example `app-list@1440x900.json`, `app-style-dialog@1440x900.json`, `app-filter-dialog@1440x900.json`.
- **Evidence:**
  - axe `button-name` (critical): the search icon button, the side-list toggle and the "Filter log content" button. The latter two have only a tooltip.
  - axe `label` (critical, 8 nodes): the 8 color inputs in the style dialog. Their labels aren't associated.
  - The filter dialog's User, Operation and Status selects expose a zero-width-space name. The 4 range-slider handles are unnamed (`aria-input-field-name`).
  - The loading `progressbar` is unnamed.
  - Each `USER_DEBUG` expand button is named "Add", which is misleading.
  - The Home control is a link wrapping a button: two Tab stops, the first one without a name.
- **Why it matters:** screen-reader users can't tell what these controls do. Several of them are the only way to reach a feature.
- **Fix:** give every icon button a visible tooltip and the same `aria-label`. Use real `<label>`s or `aria-labelledby` for fields. Name slider thumbs "Minimum length" / "Maximum length". Name the expand button "Expand value" / "Collapse value" with `aria-expanded`. Make Home one link.
- **Files:** `logs.js`, `search.js`, `log-view.js`, `parsed-log.js`, `dialogs/style/color-pickers.js`, `dialogs/filter/filter-dialog.js`.

#### B6. Classic pages: selects and checkboxes without names (blocker, Classic)
- **Where:** `classic-log-*@1440x900.json`, `classic-class-list@1440x900.json`.
- **Evidence:**
  - axe `select-name` (critical): `#styleSelection` and `#fontSelection`. Their "Pick Style:" and "Font Size:" labels are sibling `<label>`s without `for`.
  - axe `label` (critical): the "Dont Log Class" select-all checkbox and every per-class checkbox.
- **Why it matters:** a screen reader announces "combo box" or "checkbox" with no purpose. On the class list it can't tell which class a checkbox belongs to.
- **Fix:** associate the labels (`for`/`id`, or wrap the control). Give per-row checkboxes `aria-label="Don't log <ClassName>"`.
- **Files:** `react/src/extension/debug-log-page.ts`, `react/src/extension/class-page.ts`.

#### B7. Options page: "Remove" buttons can't be reached with the keyboard (blocker, Options)
- **Where:** `options-default@1440x900.png`, `options-keyboard.json`.
- **Evidence:** each ✖ is an `<a>` without `href`, so it isn't focusable and has no role (`clickableNotFocusable`: 9 per state). The Tab walk passes from each row's path input to the next row's name.
- **Fix:** use real `<button type="button" aria-label="Remove shortcut <name>">`.
- **Files:** `chrome/app/html/options.html`, `react/src/extension/options.ts`.

### Major

#### M1. Toolbar text and controls below contrast thresholds (major, App)
- **Where:** `app-list@1440x900.json` and every app state.
- **Evidence:**
  - "Logging Activity" (disabled): #4db6ac on #009688, **1.50:1**, and so is its icon.
  - The "Find in Logs" label/placeholder: **2.54:1**. Once shrunk above the value: **1.50:1** (`app-search-no-results@1440x900.json`).
  - The "Max Logs" label: 2.54:1. The search underline: 2.54:1.
  - White on teal #009688 (the values, "Start Logging"): **3.67:1**.
  - Teal text buttons on white ("Clear filters", "Close"): **3.67:1**.
- **Fix:** pick an app-bar color that gives at least 4.5:1 with white text, or a neutral bar. Never put state on a disabled-looking button (see M11).
- **Files:** `logs.js` (`toolbarTheme`), `app.js` (`theme`).

#### M2. Log themes fail contrast on main content (major, Shared)
- **Where:** `app-log-monokai@1440x900.png`, `classic-log-monokai@1440x900.png`, and each theme's state.
- **Evidence:** WCAG ratios of each category color against the theme background (from `themes.ts`):

  | Theme | below 4.5:1 |
  |---|---|
  | Monokai (dark) | system #75715e **3.04**, error #f92672 **3.93** |
  | Emacs (light) | callout #a0a000 **2.72**, error #f92672 **3.68** |
  | Black/White | error #f92672 **3.79** |

  The Monokai "system" color covers the log header and every echoed "Execute Anonymous:" source line. That's 31 elements in the first classic screen and the whole app intro block. The error color, the most important line of a failed log, fails in all three themes.
- **Additional problems:**
  - There is only one dark theme. The app chrome is always light, so a dark log sits in a white and teal frame.
  - Black/White tells categories apart only by weight and italics.
- **Fix:**
  - At least 4.5:1 for every category in every theme, and 7:1 for errors and `USER_DEBUG`.
  - Don't carry meaning by color alone: add an icon or gutter marker for errors.
  - Ship matched light and dark themes that follow the OS (`prefers-color-scheme`), for the chrome and the log together.
- **Files:** `react/src/core/log/themes.ts`, `chrome/app/css/debug.css`.

#### M3. Style dialog: color fields are unreadable and the labels are jargon (major, App)
- **Where:** `app-style-dialog@1440x900.png`.
- **Evidence:**
  - Each color field shows its hex value in that color on white: Rest #f8f8f2 **1.07:1** (invisible), Method 1.42, Debug 1.55, Soql 1.65, Callout 2.84.
  - There is no swatch and no preview of the log.
  - The labels are internal category names ("Rest", "Soql", "Method"). The helper texts are truncated lists of event names ("SYSTEM_ ENTERING_MANAGED_PKG").
  - The dialog is a full-height modal, mostly empty, with "Close" as the only action. There is no reset to the theme defaults.
- **Fix:**
  - Use a swatch and the hex value in normal text color.
  - Use plain labels ("Debug output", "Database (SOQL/DML)", "Errors", "Other"), each with a sample line.
  - Show a live preview, and add "Reset to theme".
  - Consider a side panel or popover instead of a modal, so the log stays visible while the user adjusts it.
- **Files:** `dialogs/style/style.js`, `dialogs/style/color-pickers.js`.

#### M4. Search has almost no feedback (major, App)
- **Where:** `app-search-results@1440x900.png`, `app-search-no-results@1440x900.png`.
- **Evidence:**
  - The only result signal is a snackbar, "Found 2 matching logs in 12 searched", with `autoHideDuration` 1000 ms.
  - Afterwards nothing shows that the list is filtered, and the term scrolls out of the 200 px field.
  - With no results, the table shows headers and nothing else.
  - Search runs only on Enter or the icon. It downloads every body with no progress.
  - Inside an opened log the term isn't highlighted and there is no next/previous match. Users fall back to Ctrl+F, which can't reach collapsed values.
  - Escape clears the field but leaves the screen otherwise unchanged.
- **Fix:**
  - Make "Showing 2 of 36 logs matching 'X' · Clear" persistent.
  - Show the match count and a snippet per row.
  - Show an empty state with a "Clear search" action.
  - Show progress while bodies download.
  - In a log, highlight matches and support n/N or Enter/Shift+Enter navigation with a "3/17" counter.
- **Files:** `components/search.js`, `logs.js`, `reducer.js`, `components/parsed-log.js`.

#### M5. Loading, error and empty states are missing or misleading (major, App)
- **Where:** `app-loading@1440x900.png`, `app-error-unreachable-org@1440x900.png`, `app-error-after-message-hides@1440x900.png`, `app-search-no-results@1440x900.png`.
- **Evidence:**
  - Loading shows table headers and a 40 px spinner squeezed into the toolbar. The toolbar icons shift down 3 px while it shows.
  - An error shows as a transient snackbar, "Error occured: Failed to fetch", with a typo and the raw message. After it hides, the screen looks exactly like an org with no logs. There is no retry and no hint (session expired? no access?).
  - The logging control says "Start Logging" during loading and after errors, although logging is on.
  - Opening a log shows nothing at all until the body arrives.
- **Fix:**
  - Use skeleton rows or a progress bar under the toolbar.
  - Show an inline error panel with cause, retry and "Open Salesforce to log in again".
  - Show an empty state that explains how logs appear ("Logging is on for you until 14:30. Run something, then Refresh").
  - Use an unknown or neutral state for logging while it's being checked.
- **Files:** `logs.js`, `actions.js`, `reducer.js`, `components/tracking-logs.js`, `components/log-view.js`.

#### M6. Active filters are invisible, and the content filter's meaning is inverted (major, App)
- **Where:** `app-filter-dialog@1440x900.png`, `app-content-filter-dialog@1440x900.png`.
- **Evidence:**
  - After closing the filter dialog nothing in the toolbar or list shows which filters apply. This includes the defaults from B1. Server-side filters apply only after a manual refresh.
  - The content filter ("Filter log contents") lists the event types to *show*. Empty means show everything, so "Remove All" and "Add All" both end up showing every line. Removing the last chip shows everything again.
  - The content filter is kept in sessionStorage across logs with no indicator on the log.
  - The content dialog has no Close or Done button.
  - The filter dialog's "Pick Fields to filter by:" plus a helper per field ("Only show logs when User is:") is wordy, while the slider ranges are unexplained.
- **Fix:**
  - A filter bar of chips under the toolbar (user, operation, status, size, duration, event types), each removable, with "Clear all". Apply immediately.
  - For event types, use a checklist or toggle group ("Show: Debug ✓ SOQL ✓ System ✗ …") with a count of hidden lines.
- **Files:** `dialogs/filter/*`, `dialogs/log-content-filter/*`, `core/log/parsing.ts` (`filterEntries`).

#### M7. Long logs are slow to read and have no structure (major, App)
- **Where:** `app-log-monokai-scrolled@1440x900.png` compared with `classic-log-monokai-scrolled@1440x900.png`.
- **Evidence:**
  - At the default 19 px with a 0.6 em gap between entries, the app shows **about 22 entries** per 900 px screen. The classic view shows about 40. Each `USER_DEBUG` also gets a 24 px icon button.
  - There are no line numbers and no gutter, and the timestamp, nanoseconds and line number on every line all have the same weight.
  - There is no way to jump to the first error, the next `USER_DEBUG` or the next SOQL, and no fold for the echoed source or the limit-usage block.
  - With 211 Tab stops in a 222-line log (expand buttons and ID links), keyboard reading is impractical (`app-keyboard-log.json`).
  - Opening another log keeps the previous scroll offset. `app-log-failed-run@1440x900.png` opens partway down.
- **Fix:**
  - A dense default (13–14 px, line height around 1.45, no extra gap).
  - A gutter with line numbers and category or error markers.
  - De-emphasized timestamp columns.
  - An outline or minimap of errors, debug output and SOQL, with "next/previous" for each.
  - Collapsible blocks (source echo, limits).
  - Virtualized rendering for large logs.
  - Start each log at the top, or at the first error for failed runs.
  - One Tab stop for the log body, with keyboard navigation inside it.
- **Files:** `components/parsed-log.js`, `components/log-view.js`, `core/log/parsing.ts`.

#### M8. The log side list is cramped and ambiguous (major, App)
- **Where:** `app-log-monokai@1440x900.png`, `app-log-side-list-toggled@1440x900.png`, `app-log-monokai@1024x768.png`.
- **Evidence:**
  - The operation is cut at the panel edge with no ellipsis or tooltip.
  - The round toggle button overlaps the first entry. Closed, it's a ">" button that overlaps the log text, and on dark themes it's dark on dark.
  - The current log is marked only by a 4 px gray shadow, and it scrolls out of view.
  - At 1024 px the panel is 20% wide, so dates wrap onto two lines.
  - The list is not exposed as a list (axe `list`, serious), and status and user aren't shown.
- **Fix:**
  - A resizable panel with a minimum width and an ellipsis plus tooltip for long operations.
  - A clear selected state (background, `aria-current`), kept in view.
  - A collapse control in the panel header, not floating over content.
  - Status and size on each entry.
- **Files:** `components/log-view.js`.

#### M9. Failed runs look like successful ones (major, App)
- **Where:** `app-list@1440x900.png`. The rows with Status "Divide by 0" look like the rest.
- **Evidence:**
  - Status is plain text in the same color. The side list doesn't show it at all.
  - The operation column shows the full API path (`/services/data/v62.0/tooling/executeAnonymous/`) on every row, which wastes the widest column.
  - "User" shows just a name, even when all logs are the user's own.
- **Fix:**
  - A status chip with an icon and color (Success, or Error with its message).
  - A short operation name with the full value in a tooltip.
  - Hide or dim columns that don't vary, and allow sorting.
  - Highlight new logs since the last refresh.
- **Files:** `components/logs-table.js`, `components/log-view.js`.

#### M10. Classic theme and font selects have no visible focus (major, Classic)
- **Where:** `classic-keyboard-log.json`, stops `select#styleSelection` and `select#fontSelection`: `focusIndicatorVisible: false`.
- **Evidence:** `debug.css` sets `select { outline: none }` globally on the page, with low-contrast styling (#888 text on #f8f8f8).
- **Fix:** remove `outline: none`, scope the styles to the extension's controls, and use a visible `:focus-visible` ring.
- **Files:** `chrome/app/css/debug.css`.

#### M11. Logging starts silently, can't be stopped, and its state looks like a disabled checkbox (major, App)
- **Where:** toolbar, right side, every app state.
- **Evidence:**
  - Opening the app runs `checkIsLoggingAndStart()`, which creates a trace flag for the user if there is none, without telling them.
  - The state is shown as a disabled button with a checked-box icon, "Logging Activity", at 1.50:1.
  - There is no way to stop logging, see until when it runs, or choose the debug level.
- **Fix:**
  - A clear status control: "Logging on · until 15:42 · Stop / Extend", or "Logging off · Start".
  - Starting is an explicit action, or at least a visible notice ("Started logging for you for 1 hour").
  - Show the debug level used.
- **Files:** `components/tracking-logs.js`, `actions.js`.

#### M12. Options page: unlabeled fields and no explanation of what a shortcut does (major, Options)
- **Where:** `options-default@1440x900.png`, `options-new-row@1440x900.png`.
- **Evidence:**
  - axe `label-title-only` on 30 inputs. Their labels are only `title` attributes, and the custom `label=""` attribute does nothing.
  - The page has no heading, title or intro (axe `page-has-heading-one`, `landmark-one-main`).
  - Nothing says that "Key" means Shift+key opens in a new tab and Alt+Shift+key in the current tab. There's no conflict check against other rows, and the built-in `Shift+L` (open last log) isn't listed.
  - New rows show placeholders ("Accounts", "a", "/001") that look like entered values.
  - Long paths are cut off (7 clipped values).
  - The session-token warning is crammed into a table header, and the token is stored unencrypted.
- **Fix:**
  - Page title and intro.
  - Sections: "Keyboard shortcuts" and "Session (advanced)".
  - Visible column labels tied to inputs.
  - A key-capture field that shows "Shift + D", with duplicate detection.
  - A preview of where the shortcut goes.
  - Placeholder text clearly styled as a hint.
- **Files:** `chrome/app/html/options.html`, `chrome/app/css/options.css`, `react/src/extension/options.ts`.

#### M13. Options page: Save and Restore Defaults give no feedback; Restore has no confirmation (major, Options)
- **Where:** `options-save-invalid@1440x900.png`.
- **Evidence:**
  - "Save" is an `<a href="./options.html">`. It writes storage and reloads the page with no "Saved" message.
  - An invalid row gives only red borders and a 0.5 s shake, with no text saying what's wrong.
  - "Restore Defaults" immediately overwrites all custom shortcuts, with no confirmation or undo. It sits next to Save and has the same style.
  - The buttons use white on #33c3f0 (2.06:1) at 11 px.
- **Fix:**
  - Real buttons, inline validation messages, and a "Saved" status.
  - Confirm Restore Defaults, and offer undo.
  - Make the primary Save visually distinct from secondary actions.
- **Files:** `chrome/app/html/options.html`, `react/src/extension/options.ts`, `chrome/app/css/options.css`.

#### M14. Classic log page: controls scroll away and are hard to recognize (major, Classic)
- **Where:** `classic-log-monokai@1440x900.png`, `classic-log-monokai-scrolled@1440x900.png`.
- **Evidence:**
  - The theme, font, Expand All and "Show …" controls sit above the log and scroll away. A long log means scrolling back to the top to change anything.
  - "Font Size:" and "Pick Style:" are monospace text next to borderless selects, so they don't look like controls.
  - "Expand All" is white on lime, **2.14:1**.
  - Long lines make the whole Salesforce page scroll horizontally, and the header line is cut at the right edge.
  - The hotkeys exist only as underlined letters (S, U, T, E).
  - Toggling timestamps reloads the page.
- **Fix:** a compact sticky toolbar with standard controls, wrapping or horizontal scroll inside the log box only, a "Keyboard shortcuts" hint, and a timestamps toggle that applies without a reload.
- **Files:** `react/src/extension/debug-log-page.ts`, `chrome/app/css/debug.css`.

#### M15. Shortcuts are undiscoverable, and some are risky (major, Shared)
- **Evidence:** keys are bound on every Salesforce page and in the app, but no part of the UI lists them:
  - On every Salesforce page: `e` clicks Edit and `s` clicks **Save**. These are unmodified single letters, outside inputs.
  - On every Salesforce page: Shift+W, Shift+L and Shift plus each options-page key; Alt+Shift+key opens in the same tab.
  - In the app: `r` reloads and `a` deletes all.
  - On the classic list: `l`, `u`, `c`, `r` and `a`.
  - On the classic log page: `s`, `u`, `t` and `e`.

  Only the classic pages hint at their keys through underlined letters.
- **Why it matters:** users can't learn the fastest paths, and an accidental `s` or `a` has side effects.
- **Fix:**
  - One shortcut registry shown in a `?` help overlay in every view, and on the options page.
  - Modifiers for anything that changes data.
  - Show keys in tooltips ("Refresh (R)").
  - A way to turn off the global page shortcuts.
- **Files:** `react/src/extension/shortcuts.ts`, `react/src/extension/debug-log-list.ts`, `react/src/extension/debug-log-page.ts`, `react/src/pages/logs/logs.js`, `react/src/core/default-shortcuts.ts`.

#### M16. Classic log list: search highlight is unreadable and gives no feedback (major, Classic)
- **Where:** `classic-list-search@1440x900.png`, `classic-list-search@1440x900.json`.
- **Evidence:**
  - Matching rows get background #68aa57. On it, the "View | Download | Delete" links are #015ba7 at **2.45:1**, and the separators #999 at **1.01:1**.
  - There is no count, no "no matches" message and no way to show only matches. Progress is a cursor change and a small GIF.
  - "Delete (A)ll" sits between the search box and "(L)oad New Logs", styled as an ordinary button.
  - The Search button is 9.8 px and "Add Current (U)ser" is 10.8 px.
- **Fix:** a subtle highlight with enough contrast (or filter to matches), a result count, and the destructive button separated and styled as danger (see B4).
- **Files:** `react/src/extension/debug-log-list.ts`, `chrome/app/css/debug.logs.css`.

#### M17. The app list wastes the screen and lacks basic list tools (major, App)
- **Where:** `app-list@1440x900.png`.
- **Evidence:**
  - The toolbar has no app name or org, so with several orgs open it's unclear which org this tab shows.
  - "Max Logs" is a bare number field in the toolbar that reloads on blur, with placeholder "1".
  - There's no sorting, no auto-refresh or "new logs" indicator, and no count of loaded logs once the "Loaded N logs" toast disappears.
- **Fix:**
  - Show the org name or host in the header.
  - Show a count ("36 logs · updated 14:42").
  - Optional auto-refresh, sortable columns, and a "load more" button instead of a max-count field.
- **Files:** `logs.js`, `components/logs-table.js`.

#### M18. Expand buttons on debug lines are hard to see and mislabeled (major, App)
- **Where:** `app-log-json-expanded@1440x900.png`.
- **Evidence:**
  - The ⊕ and ⊖ icons draw a near-black circle (#050505) on the Monokai background, **1.37:1**, with only the small white sign visible.
  - The button is named "Add".
  - Every `USER_DEBUG` gets one, even plain strings that can't be expanded. Expanding is per line only; Expand All exists only on the classic page.
  - JSON is pretty-printed without syntax colors or folding.
- **Fix:** show the control only for expandable values, as a disclosure triangle with `aria-expanded`. Add expand-all and collapse-all, and a JSON tree with folding and copy.
- **Files:** `components/parsed-log.js`.

### Minor

- **m1 (App):** the toolbar's Home link wraps an IconButton, which makes 2 Tab stops, the first unnamed (`app-keyboard-list.json`, stop 1). It's also unclear where "Home" goes, since the app has one page.
- **m2 (Shared):** typos and inconsistent copy. "Error occured", "Dont Log Class", "See All Trigger", "Sea(r)ch logs..", "Collaps(e) All", "LOGGING ACTIVITY" in all caps, and sentence case mixed with Title Case.
- **m3 (App):** after a dialog closes, focus returns to the toolbar button and its tooltip ("Style settings") stays over the content (`app-log-monokai@1440x900.png`).
- **m4 (App):** MUI dialogs let focus leave to `<body>` once per Tab cycle before wrapping (`app-keyboard-dialogs.json`: `tabStopsOutsideDialog: ["body", "body"]` for Filters). Focus does return to the trigger on Escape.
- **m5 (Shared):** times are in the browser's time zone in the app and the user's Salesforce time zone on classic pages (14:29:35 compared with 05:29:35 in the screenshots). Formats differ too ("Oct 11, 2026, 14:29:35" against "10/11 05:29:35").
- **m6 (App):** sizes are inconsistent: "2.66 k" in the list, "2.661k" in the side list and bytes on the classic page. "Run Duration 63ms" has no space.
- **m7 (App):** ID linkification has false positives. Parts of usernames and e-mail domains (`00d1i000002wltfua2`) become links (`app-log-json-expanded@1440x900.png`).
- **m8 (App):** the native search field's clear "×" is dark blue on teal and overlaps the text (`app-search-results@1440x900.png`).
- **m9 (App):** no page landmarks or heading (axe `landmark-one-main`, `page-has-heading-one`, `region`) in any app state. The tab title is always "Apex Debugger", not the org or the log.
- **m10 (Shared):** the log font stack is `'Courier New', 'Courier', mono`. `mono` isn't a generic family, and Courier New is thin and low-contrast at small sizes. Use a modern monospace stack ending in `monospace`.
- **m11 (App):** the filter dialog's sliders are a fixed 400 px with a 50 px margin. The ranges are arbitrary and the endpoints are hard to set exactly. There are no numeric inputs.
- **m12 (App):** the snackbar position (bottom center) is far from the toolbar that triggered it. Messages last 1 s, too short to read, and aren't announced (`aria-live`).
- **m13 (App):** the "Text Wrap" switch uses indigo while everything else uses teal. Primary and secondary colors are used inconsistently across dialogs.
- **m14 (Classic):** the class list's "Dont Log Class" column is 10.8 px, has no explanation, and sits next to Salesforce's own "Has Trace Flags", which reads like the same thing. The flag lasts 24 hours, which the UI doesn't say.
- **m15 (Options):** values in narrow inputs are truncated with no way to see the full path except by scrolling the field.
- **m16 (App):** the side list and the content filter keep state in sessionStorage per tab, and filter state is lost on reload. This persistence is inconsistent and not visible to the user.

## Task walkthroughs (current UI)

| Task | Steps today | Problems |
|---|---|---|
| Find the log for something I just ran | Shift+W on a Salesforce page → list loads (with hidden filters) → look for the time | Logs over 2.5 MB or 12 s never appear (B1). No "new" marker. Failed runs look like successes (M9). Can't open with the keyboard (B2). |
| Search for a string | Type in "Find in Logs" → Enter → read the toast within 1 s | No persistent state or empty state. No highlight inside the log (M4). |
| Filter by user or operation | Filter icon → open select → choose → Close → (Refresh for server side) | No sign the filter is active afterwards (M6). Selects unnamed (B5). |
| Read a long log | Click a row → scroll | About 22 entries per screen. No error navigation. Scroll offset carried over (M7). Low-contrast system lines (M2). |
| Expand a JSON debug line | Find the ⊕ on the line → click | Barely visible icon named "Add". One line at a time (M18). |
| Change theme or font size | Style icon → select theme / type size → Close | Unreadable color fields. Jargon labels (M3). Classic: controls scroll away (M14). |
| Start or stop logging | Starts silently when the app opens. Stopping is impossible in the app | M11 |
| Delete logs | One click on the trash icon, or the `a` key, deletes every log in the org | No confirmation, scope or undo (B4) |
| Set a shortcut | Right-click the extension → Options → Add New → fill three unlabeled fields → Save (page reloads) | No explanation of modifiers, no "Saved", no conflict check (M12, M13). Remove isn't keyboard accessible (B7). |

## Design direction for the redesign

Principles, each traced to the findings above:

1. **Never hide or destroy without saying so.** Every filter, search and content filter is visible as state, with one place to clear it (B1, M4, M6). Destructive actions are separated, confirmed with their scope, and reported afterwards (B4, M13).
2. **The log is the product.** Optimize for reading and navigating large logs: density, structure, jump-to, find-in-log (M7, M18). Chrome (toolbars, dialogs) should be compact and get out of the way.
3. **Keyboard-first and accessible by default.** Every action is reachable by Tab and has a name, and every view has a discoverable shortcut list (B2, B5–B7, M15). Target WCAG 2.2 AA, verified by `e2e/ux-audit.mjs`.
4. **One design system for all surfaces.** The app, the classic page enhancements and the options page share tokens (color, type, spacing), components and copy (M10, M14, m2, m5, m6).
5. **Explain state, especially org state.** Which org, logging on or off and until when, how many logs, what's filtered, what's loading or failing (M5, M11, M17).

### Information architecture

- **App shell:** a header with the app name, **org name and host**, logging status control, refresh, and a `?` (shortcuts and help) button. Put the less common actions (delete logs, style, settings) in an overflow menu. "Delete logs…" sits in a "Danger" section.
- **Main area: master–detail** in the app itself.
  - Left: a resizable log list. It defaults to about 320 px and collapses to an icon rail; below about 900 px it becomes a separate route.
  - Right: the log viewer. This replaces today's separate table page plus fixed side list, which turns into a cramped 20% column in the log view (M8).
  - The list stays a sortable table when the detail pane is closed (wide mode). It shows time (relative plus absolute on hover), short operation, status chip, user (hidden when all logs are the current user's), duration and size. New logs since the last refresh are marked.
- **Filter bar** under the header: a search field ("Search in N loaded logs"), then removable chips for user, operation, status, size, duration and a "+ Filter" menu. Results are live, with a count ("12 of 36 logs") and a "Clear all" link.
- **Log viewer header:** log metadata (operation, status, user, start, duration, size, API version and log levels) and actions (download, open in Salesforce, copy link). It also holds an in-log find box with a match counter and an event-type toggle group ("Debug, SOQL/DML, Methods, System, Limits") with hidden-line counts.
- **Log outline:** a narrow gutter or minimap showing errors, `USER_DEBUG` and SOQL positions, plus "Next error / Next debug" buttons. A failed log opens at its first error.
- **Settings:** a settings page or drawer shared by the app and the options page. Sections: Appearance (theme, font, density, wrap), Keyboard shortcuts, Session (advanced). The options page becomes this same component.

### Layout

- Responsive down to 1024 px without overlap: the toolbar collapses into an overflow menu, and no floating buttons sit over content (B3).
- 8 px spacing grid, with a 40 px header and 32 px dense list rows on desktop.
- The log scrolls inside its own pane; the page itself never scrolls horizontally. Long lines wrap (the default) or scroll inside the pane.

### Typography and monospace

- UI: system UI font stack, 13–14 px base, a clear type scale (12/13/14/16/20). No all-caps buttons; use sentence case throughout (m2).
- Log: a modern monospace stack (`ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace`). Default 13 px with line height around 1.45 and no extra gap between entries (M7). Font size and density are adjustable, with live preview.
- Line anatomy: a gutter with the line number and category marker, then a muted timestamp column, then the event type as a small label, then the message in full contrast. Collapse the nanosecond and line-number fields, or show them on hover.

### Themes: light and dark

- Theme tokens (background, surface, text, muted, border, focus, accent, danger, plus one token per log category) drive the app chrome, the log and the classic page through the CSS custom properties that `themes.ts` already generates.
- Ship **Light** and **Dark** themes that follow `prefers-color-scheme` by default, with a manual override. Keep "Monokai" and "High contrast" as extra log palettes, and drop "Emacs" or fix it (M2).
- Contrast rules, checked by the audit script: at least 4.5:1 for every log category and all UI text; at least 7:1 for errors and `USER_DEBUG`; at least 3:1 for icons, input borders and the focus ring. Errors also get an icon or gutter marker, never color alone.
- Custom colors come from a palette editor with swatches, a sample line per category and "Reset to theme" (M3). Names are user-facing ("Debug output", "Database", "Errors", "Code units and methods", "System", "Other").

### Toolbar and actions

- Primary actions are always visible: Refresh, search and filters, and the logging status. The rest goes in a labeled overflow menu. Every icon button has a tooltip with its shortcut and the same accessible name.
- Logging status is a single control: "Logging on · until 15:42" with a menu (Extend, Stop, Debug level), or "Logging off" with a "Start logging" button. The app never starts logging without telling the user (M11).

### Search and filter UX

- Search in loaded logs: live with debounce, case-insensitive. Show a progress bar while bodies download ("Searching 36 logs…"), then a persistent "12 of 36 match" plus per-row match counts and a snippet.
- Find in the opened log: Ctrl/Cmd+F is captured inside the viewer (with a way to reach the browser's own find). It highlights all matches, including inside collapsed values, with Enter/Shift+Enter or F3 to move and a "3/17" counter. Optional regex.
- List filters are chips, applied immediately, with real bounds and no hidden defaults (B1). Event-type visibility is a toggle group with counts. Persisted filters show as chips the moment the app opens.

### Destructive actions

- "Delete logs…" opens a dialog with a scope choice ("Only my logs", the default, or "All users' logs in <org>"), the count, and a confirmation button that names the action ("Delete 1,234 logs"). Show progress, then a result message. There is no single-key shortcut for it; at most a modified shortcut that opens the dialog (B4).
- Restoring default shortcuts and resetting a theme ask for confirmation or offer undo (M13).

### Empty, loading and error states

- **Loading:** skeleton rows in the list and a skeleton log body. A thin progress bar under the header for background work. No layout shift.
- **Empty (no logs):** say why, and what to do: "No logs yet. Logging is on until 15:42: run something in Salesforce, then Refresh." Include a Refresh button and a link to the Debug Logs page.
- **Empty (filtered or search):** "No logs match 'X'" with "Clear search" and "Clear filters".
- **Error:** an inline panel in the area that failed, with a plain-language cause (session expired, no permission, org unreachable), Retry, and "Open Salesforce to sign in again". The technical detail is collapsible. Errors stay until resolved instead of disappearing after 1 s (M5).
- **Toasts** only for confirmations ("Deleted 36 logs", "Saved"). Show them for 4–6 s, in an `aria-live` region, near the action.

### Keyboard shortcuts and discoverability

- One shortcut registry, used by the app, the content scripts and the options page.
- A `?` overlay lists all shortcuts for the current view. Tooltips show keys. The command palette (Ctrl/Cmd+K) is optional but fits this audience (VS Code, DevTools).
- Global page shortcuts on Salesforce pages need a modifier (no bare `e` or `s`). They can be turned off, and conflicts are detected in settings (M15).
- Shortcuts in the app:
  - `/` focuses search and `Esc` clears it.
  - `j` and `k` (or ↑/↓) move through the list, and Enter opens the log.
  - `[` and `]` go to the previous and next log.
  - `e` goes to the next error; `d` goes to the next debug line.
  - `R` refreshes.

  None of them deletes data.

### Classic page enhancements

- Use the same tokens and theme as the app.
- Give the classic page a compact sticky toolbar: theme, font size, wrap, show system/user methods, timestamps, Expand all, and "Open in Apex Debugger".
- Label all controls properly and give them a visible focus ring; scope styles so they never change Salesforce's own controls (M10, M14).
- On the classic list, use the same search feedback and destructive-action pattern as the app (M16, B4).

## What this review could not check

- **Screen reader output.** Names and roles were checked through Chrome's accessibility tree and axe, not by listening with VoiceOver or NVDA.
- **Lightning Experience pages.** Shift+W from Lightning is covered by the e2e flow; the review used the classic Setup pages, where the extension adds UI.
- **Very large logs** (several MB) for rendering performance and scrolling. The test log has 222 lines. A 19.5 MB log happened to be in the org, but the app hides it (B1).
- **The actual delete-all flow and Restore Defaults.** These weren't triggered, because the org is shared with other runs and the actions are destructive. Their behavior is taken from the code.
- **Zoom at 200% and 400%**, Windows high-contrast mode, `prefers-reduced-motion` and touch were not tested. Viewports below 1024 px were not captured.
- **Focus-indicator detection** compares pixels around the element with and without focus. A tooltip that appears on focus counts as "visible" even without a focus ring, so app results may be optimistic.
- **The contrast check** composites ancestor background colors but ignores background images, overlapping siblings and text shadows. Gradients are flagged (`backgroundImage: true`) rather than measured.
- **The Chrome Web Store listing and the toolbar popup.** The extension has no popup.

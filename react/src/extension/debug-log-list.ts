// Content script on the classic debug log list (listApexTraces.apexp): Load
// new logs, Delete logs… (only mine or all users', confirmed with the count
// each time, Bulk API 2.0), Add current user, logs per page, and search in the
// log bodies with a result count. Opens the log viewer for ?openApp=yes (see
// shortcuts.ts).
//
// The controls use the design tokens (classic-ui.ts, css/classic.css); the
// dialog follows the user's color mode. Keyboard shortcuts come from the
// registry (core/page-shortcuts.ts) and none of them changes data
// (docs/ux/baseline-review.md B4, M15, M16).
import Mousetrap from 'mousetrap'
import {
  getSession,
  getUserId,
  openAppMessage,
  pageSalesforce,
  parseDiscoCookie
} from '../core/page-session'
import { CLASSIC_LOG_LIST_SHORTCUTS } from '../core/page-shortcuts'
import { colors } from '../ui/tokens'
import { explainError } from '../core/salesforce/errors'
import type { DeleteProgress } from '../core/salesforce/client'
import {
  checkbox,
  followColorMode,
  h,
  injectDesignTokens,
  pageShortcutSettings
} from './classic-ui'

const sf = pageSalesforce()

const LOGS_TABLE_ID = 'Apex_Trace_List:traceForm:traceTable:thetracetable:tb'
const LOGS_TABLE_ID_ESCAPED = LOGS_TABLE_ID.replace(/:/g, '\\:')
const USERS_TABLE_ID = 'Apex_Trace_List:monitoredUsersForm'
let showLogsNum = 50
const tableElement = document.getElementById(LOGS_TABLE_ID)

// Log bodies downloaded by a search on this page, by id: a second search
// (another term, or the same after Load new logs) only downloads new logs.
const bodies = new Map<string, Promise<string>>()
let searchRun = 0

async function openAppIfRequested() {
  if (!document.location.search.includes('openApp=yes')) {
    return
  }
  const { orgId, userId } = parseDiscoCookie()
  const session = await getSession()
  chrome.runtime.sendMessage(openAppMessage(orgId, userId, session))
  window.close()
}

async function initKeyTraps() {
  const settings = await pageShortcutSettings()
  if (settings && !settings.enabled) return
  const handlers: Record<string, (event: KeyboardEvent) => boolean> = {
    loadNew: () => {
      document.getElementById('load_new_logs').click()
      return false
    },
    search: () => {
      document.getElementById('FilterByText').focus()
      return false
    },
    clearSearch: () => {
      clearSearch()
      return false
    }
  }
  for (const shortcut of CLASSIC_LOG_LIST_SHORTCUTS) {
    if (handlers[shortcut.id])
      Mousetrap.bind(shortcut.keys, handlers[shortcut.id])
  }
}

function initPage() {
  openAppIfRequested()
  injectDesignTokens()
  addListTools()
  removeOldDeleteBtn()
  addAddUserBtn()
  addSearchControllers()
  initKeyTraps()
}

function removeOldDeleteBtn() {
  // Salesforce's own "Delete All" deletes every log without a scope.
  document.querySelectorAll('[value="Delete All"]').forEach(button => {
    button.remove()
  })
}

function addAddUserBtn() {
  const form = document.getElementById(USERS_TABLE_ID)
  const pbButton = form && form.querySelector('.pbButton')
  if (!pbButton) return
  const result = h('span', {
    id: 'adAddUserResult',
    className: 'ad-muted',
    attrs: { role: 'status' }
  })
  pbButton.appendChild(
    h(
      'span',
      {
        className: 'ad-root ad-inline-tools',
        dataset: { adColorMode: 'light' }
      },
      h('button', {
        type: 'button',
        className: 'ad-button',
        id: 'add_current_user',
        text: 'Add current user',
        title:
          'Log your actions for the next 24 hours (a USER_DEBUG trace flag)',
        onclick: (event: Event) => addCurrentUser(event, result)
      }),
      result
    )
  )
}

function addListTools() {
  const form = document.getElementById('Apex_Trace_List:traceForm')
  const nextPrev = document.getElementById(
    'Apex_Trace_List:traceForm:traceTableNextPrev'
  )
  if (nextPrev) nextPrev.style.display = 'none'
  const title = document
    .getElementById('Apex_Trace_List:traceForm:traceTable')
    ?.querySelector<HTMLElement>('.mainTitle')
  if (title) title.style.display = 'none'
  const container = form && form.querySelector('.pbButton')
  if (!container) return
  const perPage = h('input', {
    type: 'number',
    id: 'adLogsPerPage',
    min: '25',
    max: '1000',
    step: '25',
    value: String(showLogsNum)
  })
  perPage.addEventListener('change', () => {
    const value = Math.floor(Number(perPage.value))
    if (value >= 1) {
      showLogsNum = Math.min(value, 1000)
      loadLogs()
    }
  })
  const deleteButton = h('button', {
    type: 'button',
    id: 'real_delete_all',
    className: 'ad-button ad-button-danger',
    text: 'Delete logs…',
    attrs: { 'aria-haspopup': 'dialog' }
  })
  deleteButton.addEventListener('click', () => openDeleteDialog(deleteButton))
  const loadNew = h('button', {
    type: 'button',
    id: 'load_new_logs',
    className: 'ad-button',
    text: 'Load new logs',
    title: 'Load new logs (L)',
    onclick: loadNewLogs
  })
  loadNew.setAttribute('aria-keyshortcuts', 'L')
  container.appendChild(
    h(
      'span',
      {
        className: 'ad-root ad-list-tools',
        dataset: { adColorMode: 'light' },
        attrs: {
          role: 'region',
          'aria-label': 'Apex Debugger: debug log tools'
        }
      },
      loadNew,
      h(
        'span',
        { className: 'ad-field' },
        h('label', { htmlFor: 'adLogsPerPage', text: 'Logs per page' }),
        perPage
      ),
      h('span', { className: 'ad-danger-zone' }, deleteButton),
      h('span', {
        id: 'adDeleteResult',
        attrs: { role: 'status' }
      })
    )
  )
}

function loadedLogIds(): string[] {
  return [...tableElement.children]
    .map(tr => {
      const a = tr.querySelector('a[href*="apex_log_id="]') as HTMLAnchorElement
      return a ? new URL(a.href).searchParams.get('apex_log_id') : null
    })
    .filter(Boolean)
}

function loadNewLogs() {
  const oldLogIds = loadedLogIds()
  requestLogs().then(function (logs) {
    const deltaLogs = logs.filter(log => oldLogIds.indexOf(log.Id) === -1)
    const deltaLogTrs = deltaLogs.map(logRecordToTr)
    deltaLogTrs.forEach(addToTable)
    animateTrsAddition(deltaLogTrs)
    removeOldLogs()
  })
}

function removeOldLogs() {
  const oldTrs = [
    ...document.querySelectorAll<HTMLElement>(
      `#${LOGS_TABLE_ID_ESCAPED} tr:nth-child(n+${showLogsNum + 1})`
    )
  ]
  oldTrs.forEach(tr => tr.remove())
}

function loadLogs(): Promise<void> {
  clearTable()
  return requestLogs().then(function (logs) {
    logs.map(logRecordToTr).forEach(addToTable)
  })
}

function addToTable(tr: HTMLElement) {
  if (tableElement.firstChild) {
    tableElement.insertBefore(tr, tableElement.firstChild)
  } else {
    tableElement.appendChild(tr)
  }
}

// All logs in the org, like Salesforce's own list. Filtering by the users in
// the "Monitored Users" table hid logs of entities without a user link there,
// such as the Automated Process user (#10).
function requestLogs(): Promise<any[]> {
  return (
    sf
      .recentLogs(showLogsNum)
      // Newest first from the query; the table is filled by inserting each row
      // at the top, so add them oldest first.
      .then(logs => logs.reverse())
      .catch(function (err) {
        console.error(err)
        return []
      })
  )
}

// New rows are briefly highlighted (no motion with reduced motion).
function animateTrsAddition(trs: HTMLElement[]) {
  trs.forEach(tr => tr.classList.add('ad-new-row'))
  setTimeout(() => trs.forEach(tr => tr.classList.remove('ad-new-row')), 3000)
}

function logRecordToTr(logObj: any) {
  const tr = document.createElement('tr')
  tr.className = 'dataRow'
  tr.dataset.id = logObj.Id
  const startTime = new Date(Date.parse(logObj.StartTime)).toLocaleString()
  // Built with textContent, not innerHTML: Operation, Request and the user
  // name come from the org's data, and requests to public Sites control some
  // of them, so they must never be parsed as HTML.
  const actions = cell('dataCell  actionColumn')
  actions.append(
    link(
      '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' +
        encodeURIComponent(logObj.Id),
      'View'
    ),
    ' | ',
    link(
      '/servlet/servlet.FileDownload?file=' + encodeURIComponent(logObj.Id),
      'Download'
    )
  )
  const user = cell('dataCell')
  user.append(
    link(
      '/' + encodeURIComponent(logObj.LogUserId),
      logObj.LogUser ? logObj.LogUser.Name : ''
    )
  )
  tr.append(actions, user)
  ;[
    logObj.Request,
    logObj.Application,
    logObj.Operation,
    logObj.Status,
    logObj.DurationMilliseconds,
    logObj.LogLength,
    startTime
  ].forEach(value => {
    const td = cell('dataCell')
    td.textContent = value == null ? '' : String(value)
    tr.append(td)
  })
  return tr
}

function cell(className: string) {
  const td = document.createElement('td')
  td.className = className
  td.colSpan = 1
  return td
}

function link(href: string, text: string, className?: string) {
  const a = document.createElement('a')
  a.href = href
  a.className = className || 'actionLink'
  a.textContent = text
  return a
}

function clearTable() {
  tableElement.replaceChildren()
}

// Traces the current user for 24 hours, like "Start logging" in the app, then
// reloads so the Monitored Users table shows the flag.
async function addCurrentUser(event: Event, result: HTMLElement) {
  event.preventDefault()
  const button = event.currentTarget as HTMLButtonElement
  button.disabled = true
  result.textContent = 'Adding you…'
  try {
    // The disco cookie isn't readable on every page; ask Salesforce then.
    const userId = getUserId() || (await sf.currentUser()).userId
    await sf.traceUser(userId)
    location.reload()
  } catch (err) {
    console.error('Apex Debugger: adding the current user failed', err)
    const explained = explainError(err, location.hostname)
    result.textContent = `Couldn’t add you: ${explained.title}`
    button.disabled = false
  }
}

// --- Delete logs -----------------------------------------------------------

const STEP_TEXT: Record<DeleteProgress['step'], string> = {
  finding: 'Finding the logs…',
  uploading: 'Sending the delete job to Salesforce…',
  deleting: 'Salesforce is deleting the logs…'
}

const logsText = (n: number) =>
  n === 1 ? '1 log' : `${n.toLocaleString()} logs`

// "Delete logs…": asks every time, with the scope (only my logs, the default,
// or all users' logs in the org) and how many logs that is; shows the
// progress, then the result next to the button.
function openDeleteDialog(trigger: HTMLButtonElement) {
  const counts: { mine: number | null; all: number | null } = {
    mine: null,
    all: null
  }
  let running = false
  let userId: string | undefined
  const countText = (n: number | null) =>
    n === null ? ' (counting…)' : ` (${n.toLocaleString()})`
  const mineCount = h('span', { className: 'ad-muted', text: countText(null) })
  const allCount = h('span', { className: 'ad-muted', text: countText(null) })
  const mine = h('input', {
    type: 'radio',
    name: 'adDeleteScope',
    id: 'adDeleteMine',
    value: 'mine',
    checked: true
  })
  const all = h('input', {
    type: 'radio',
    name: 'adDeleteScope',
    id: 'adDeleteAll',
    value: 'all'
  })
  const warning = h('p', {
    className: 'ad-warning',
    hidden: true,
    text: 'This also deletes other developers’ logs in this org.'
  })
  const status = h('p', { attrs: { role: 'status' } })
  const progress = h('progress', { hidden: true })
  progress.setAttribute('aria-label', 'Deleting logs')
  const cancel = h('button', {
    type: 'button',
    className: 'ad-button',
    text: 'Cancel'
  })
  const confirm = h('button', {
    type: 'button',
    className: 'ad-button ad-button-danger-solid',
    text: 'Delete logs',
    disabled: true
  })
  const dialog = h(
    'dialog',
    {
      className: 'ad-root ad-dialog',
      id: 'adDeleteDialog',
      attrs: {
        'aria-labelledby': 'adDeleteTitle',
        'aria-describedby': 'adDeleteDescription'
      }
    },
    h('h2', { id: 'adDeleteTitle', text: 'Delete debug logs' }),
    h('p', {
      id: 'adDeleteDescription',
      text: 'Deleted logs can’t be restored.'
    }),
    h(
      'fieldset',
      {},
      h('legend', { text: 'Which logs' }),
      h(
        'label',
        { className: 'ad-choice', htmlFor: 'adDeleteMine' },
        mine,
        h('span', {}, 'Only my logs', mineCount)
      ),
      h(
        'label',
        { className: 'ad-choice', htmlFor: 'adDeleteAll' },
        all,
        h('span', {}, `All users’ logs in ${location.hostname}`, allCount)
      )
    ),
    warning,
    progress,
    status,
    h('div', { className: 'ad-actions' }, cancel, confirm)
  )
  const scope = () => (all.checked ? 'all' : 'mine')
  const update = () => {
    warning.hidden = scope() !== 'all'
    const count = counts[scope()]
    confirm.disabled = running || !count
    confirm.textContent =
      count === null
        ? 'Delete logs'
        : count === 0
          ? 'Nothing to delete'
          : `Delete ${logsText(count)}`
  }
  mine.addEventListener('change', update)
  all.addEventListener('change', update)
  const close = () => {
    if (running) return
    dialog.close()
  }
  cancel.addEventListener('click', close)
  dialog.addEventListener('cancel', event => {
    if (running) event.preventDefault()
  })
  dialog.addEventListener('close', () => {
    dialog.remove()
    trigger.focus()
  })
  confirm.addEventListener('click', async () => {
    const chosen = scope()
    running = true
    mine.disabled = all.disabled = cancel.disabled = true
    update()
    progress.hidden = false
    try {
      const deleted = await sf.deleteLogs({
        userId: chosen === 'mine' ? userId : undefined,
        onProgress: p => {
          status.textContent = STEP_TEXT[p.step]
        }
      })
      running = false
      dialog.close()
      document.getElementById('adDeleteResult').textContent =
        `Deleted ${logsText(deleted)}.`
      bodies.clear()
      await loadLogs()
    } catch (err) {
      running = false
      progress.hidden = true
      mine.disabled = all.disabled = cancel.disabled = false
      const explained = explainError(err, location.hostname)
      status.className = 'ad-error'
      status.textContent = `Deleting failed. ${explained.title} ${explained.hint}`
      update()
    }
  })
  document.body.appendChild(dialog)
  followColorMode(dialog)
  dialog.showModal()
  cancel.focus()
  ;(async () => {
    try {
      userId = getUserId() || (await sf.currentUser()).userId
      const [mineTotal, allTotal] = await Promise.all([
        sf.countLogs({ userId }),
        sf.countLogs()
      ])
      counts.mine = mineTotal
      counts.all = allTotal
      mineCount.textContent = countText(mineTotal)
      allCount.textContent = countText(allTotal)
    } catch (err) {
      const explained = explainError(err, location.hostname)
      status.className = 'ad-error'
      status.textContent = `Couldn’t count the logs. ${explained.title}`
    }
    update()
  })()
}

// --- Search in log bodies ----------------------------------------------------

function addSearchControllers() {
  // Under the debug logs' title (the page also has the trace flags').
  const traceForm = document.getElementById('Apex_Trace_List:traceForm')
  const logsTitle =
    (traceForm && traceForm.querySelector('.pbTitle')) ||
    document.querySelector('.apexp .pbTitle')
  if (!logsTitle) return
  const form = h('form', {
    className: 'ad-root ad-search',
    attrs: { role: 'search', 'aria-label': 'Search in debug logs' },
    dataset: { adColorMode: 'light' }
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    searchLogs()
  })
  const input = h('input', {
    type: 'search',
    id: 'FilterByText',
    autocomplete: 'off',
    placeholder: 'Text in the log bodies'
  })
  input.setAttribute('aria-keyshortcuts', '/')
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      clearSearch()
    }
  })
  const status = h('span', {
    id: 'adSearchStatus',
    className: 'ad-muted',
    attrs: { role: 'status' }
  })
  form.append(
    h('label', { htmlFor: 'FilterByText', text: 'Search logs' }),
    input,
    h('button', { type: 'submit', className: 'ad-button', text: 'Search' }),
    h('button', {
      type: 'button',
      id: 'clear_search',
      className: 'ad-button',
      text: 'Clear',
      title: 'Clear the search (C)',
      onclick: () => clearSearch()
    }),
    checkbox('adOnlyMatches', 'Only matching logs', false, () =>
      applyOnlyMatches()
    ),
    status
  )
  logsTitle.appendChild(form)
}

const rows = () =>
  [...tableElement.children].filter(
    (row): row is HTMLTableRowElement =>
      row instanceof HTMLTableRowElement &&
      Boolean(row.querySelector('a[href*="apex_log_id="]'))
  )

function rowLogId(row: HTMLTableRowElement): string {
  const a = row.querySelector<HTMLAnchorElement>('a[href*="apex_log_id="]')
  return new URL(a.href).searchParams.get('apex_log_id')
}

function onlyMatches(): boolean {
  const box = document.getElementById('adOnlyMatches') as HTMLInputElement
  return Boolean(box && box.checked)
}

function applyOnlyMatches() {
  const active = searchActive()
  for (const row of rows()) {
    row.hidden = active && onlyMatches() && !row.classList.contains('ad-match')
  }
}

const searchActive = () =>
  Boolean(document.querySelector(`#${LOGS_TABLE_ID_ESCAPED} tr.ad-searched`))

function resetResults() {
  for (const row of [...tableElement.children] as HTMLElement[]) {
    row.classList.remove('ad-match', 'ad-searched')
    row.style.background = ''
    row.hidden = false
  }
}

function clearSearch() {
  searchRun++
  ;(document.getElementById('FilterByText') as HTMLInputElement).value = ''
  document.getElementById('adSearchStatus').textContent = ''
  resetResults()
}

function body(id: string): Promise<string> {
  if (!bodies.has(id)) {
    const request = sf.logBody(id)
    bodies.set(id, request)
    request.catch(() => bodies.delete(id))
  }
  return bodies.get(id)
}

// Downloads each listed log's body (once per page, a few at a time) and
// marks the rows that contain the text, ignoring case.
async function searchLogs() {
  const run = ++searchRun
  resetResults()
  const status = document.getElementById('adSearchStatus')
  const term = (
    document.getElementById('FilterByText') as HTMLInputElement
  ).value.trim()
  if (!term) {
    status.textContent = ''
    return
  }
  const needle = term.toLowerCase()
  const queue = rows()
  const total = queue.length
  let done = 0
  let matches = 0
  let failed = 0
  status.textContent = `Searching ${total} logs…`
  const worker = async () => {
    while (queue.length && run === searchRun) {
      const row = queue.shift()
      try {
        const text = await body(rowLogId(row))
        if (run !== searchRun) return
        row.classList.add('ad-searched')
        if (text.toLowerCase().includes(needle)) {
          matches++
          row.classList.add('ad-match')
          row.style.background = colors.light.matchBg
        }
      } catch (err) {
        console.error('Apex Debugger: downloading a log failed', err)
        failed++
      }
      done++
      if (run === searchRun)
        status.textContent = `Searching… ${done} of ${total} logs`
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  if (run !== searchRun) return
  applyOnlyMatches()
  const failures = failed ? ` ${failed} couldn’t be downloaded.` : ''
  status.textContent =
    matches === 0
      ? `No logs contain “${term}”.${failures}`
      : `${matches} of ${total} logs contain “${term}”.${failures}`
}

initPage()

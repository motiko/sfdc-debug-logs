// Content script on every Salesforce page: binds the user's page shortcuts
// (core/page-shortcuts.ts; edited on the options page, fetched through the
// service worker). Shift+W opens the log viewer. Rebinds when the user saves
// other shortcuts.
import Mousetrap from 'mousetrap'
import {
  activeShortcuts,
  bindingsFor,
  SHORTCUTS_STORAGE_KEY,
  type PageShortcut,
  type PageShortcutSettings
} from '../core/page-shortcuts'
import {
  getSession,
  openAppMessage,
  pageSalesforce,
  parseDiscoCookie
} from '../core/page-session'
import { appTabName } from '../core/app-tab'

// Combinations that also work while a field has focus (they have Ctrl/Cmd,
// so they never type a character): Save.
const inFields = new Set<string>()
const stopCallback = Mousetrap.prototype.stopCallback
Mousetrap.prototype.stopCallback = function (event, element, combo) {
  if (inFields.has(combo)) return false
  return stopCallback.call(this, event, element, combo)
}

function bindShortcuts(settings: PageShortcutSettings) {
  Mousetrap.reset()
  inFields.clear()
  for (const shortcut of activeShortcuts(settings)) {
    for (const binding of bindingsFor(shortcut)) {
      if (binding.combo.startsWith('mod+')) inFields.add(binding.combo)
      Mousetrap.bind(binding.combo, () =>
        run(shortcut, binding.effect !== 'sameTab')
      )
    }
  }
}

// Runs a shortcut. Returns false (Mousetrap then prevents the browser's
// default) only when it did something.
function run(shortcut: PageShortcut, inNewTab: boolean): boolean | void {
  if (inFlashObject()) return
  switch (shortcut.action) {
    case 'openApp':
      openApp()
      return false
    case 'openLastLog':
      openLastLog(inNewTab)
      return false
    case 'edit':
      return clickButton('edit')
    case 'save':
      return clickButton('save')
    default:
      if (inNewTab) openInNewTab(shortcut.path)
      else document.location.assign(shortcut.path)
      return false
  }
}

async function loadShortcuts() {
  const response = await chrome.runtime.sendMessage({
    command: 'getShortcuts'
  })
  if (response && response.settings) bindShortcuts(response.settings)
}

// The focused element is a Flash movie, which handles keys itself.
function inFlashObject(): boolean {
  const active: any = document.activeElement
  return (
    Boolean(active) &&
    active.nodeName == 'OBJECT' &&
    String(active.data || '').indexOf('.swf') > -1
  )
}

async function openApp() {
  const { orgId, userId } = parseDiscoCookie()
  const session = await getSession()
  // Focus the org's log viewer if it is already open.
  chrome.runtime
    .sendMessage({ command: 'focusAppTab', name: appTabName(orgId) })
    .then(appOpened => {
      if (!appOpened) {
        if (document.location.hostname.includes('.salesforce')) {
          chrome.runtime.sendMessage(openAppMessage(orgId, userId, session))
        } else {
          // *.force.com: open the classic log list, whose content script
          // (debug-log-list.ts) opens the app for ?openApp=yes.
          openInNewTab('/setup/ui/listApexTraces.apexp?openApp=yes')
        }
      }
    })
}

function openInNewTab(path: string) {
  window.open(path, '_blank')
}

// Clicks a classic page's Edit or Save button, if it has one.
function clickButton(name: 'edit' | 'save'): boolean | void {
  const button = document.querySelector<HTMLInputElement>(
    `input[name='${name}']`
  )
  if (!button) return
  button.click()
  return false
}

function openLastLog(inNewTab?: boolean) {
  pageSalesforce()
    .newestLog()
    .then(log => {
      if (!log) return
      const url =
        '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' +
        encodeURIComponent(log.Id)
      if (inNewTab) {
        openInNewTab(url)
      } else {
        document.location.assign(url)
      }
    })
}

loadShortcuts()

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[SHORTCUTS_STORAGE_KEY]) loadShortcuts()
})

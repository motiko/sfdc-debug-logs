// Content script on every Salesforce page: binds the keyboard shortcuts saved
// on the options page (or the defaults). Shift+W opens the log viewer.
import Mousetrap from 'mousetrap'
import { defaultShortcuts, type Shortcut } from '../core/default-shortcuts'
import {
  API_PATH,
  getSession,
  openAppMessage,
  parseDiscoCookie,
  sfRequest
} from '../core/page-session'

function initShortcuts({
  shortcuts = defaultShortcuts
}: {
  shortcuts?: Shortcut[]
}) {
  shortcuts.filter(s => s.path).forEach(shortcutUrl)
  shortcuts
    .filter(s => s.app)
    .forEach(shortcut => {
      shortcutMethod(shortcut.key, openApp)
    })
  Mousetrap.bind('shift+w', () => {
    openApp()
  })
}

async function sendMessage(message: any): Promise<any> {
  try {
    const response = await chrome.runtime.sendMessage(message)
    return response
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

async function getShortcuts() {
  const response = await sendMessage({ command: 'getShortcuts' })
  initShortcuts({ shortcuts: response.shortcuts })
}

// The focused element is a Flash movie, which handles keys itself.
function inFlashObject(): boolean {
  const active: any = document.activeElement
  return active.nodeName == 'OBJECT' && active.data.indexOf('.swf') > -1
}

async function openApp() {
  if (inFlashObject()) {
    return
  }
  const { orgId, userId } = parseDiscoCookie()
  const session = await getSession()
  chrome.runtime.sendMessage({ command: 'focusAppTab' }).then(appOpened => {
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

function shortcutMethod(char: string, method: (inNewTab?: boolean) => void) {
  Mousetrap.bind(['alt+shift+' + char], function () {
    method()
  })
  Mousetrap.bind(['shift+' + char], function () {
    method(true)
  })
}

function shortcutUrl({ key, path }: Shortcut) {
  Mousetrap.bind(['alt+shift+' + key], function () {
    document.location.assign(path)
  })
  Mousetrap.bind(['shift+' + key], function () {
    if (inFlashObject()) {
      return
    }
    openInNewTab(path)
  })
}

function openInNewTab(path: string) {
  window.open(path, '_blank')
}

function editObject() {
  const editBtn: HTMLInputElement | null =
    document.querySelector("input[name='edit']")
  if (editBtn) {
    editBtn.click()
  }
}

function saveObject() {
  const saveBtn: HTMLInputElement | null =
    document.querySelector("input[name='save']")
  if (saveBtn) {
    saveBtn.click()
  }
}

function openLastLog(inNewTab?: boolean) {
  sfRequest(
    API_PATH +
      '/tooling/query/?q=' +
      encodeURIComponent(
        'SELECT Id,LastModifiedDate,StartTime,Status,SystemModstamp FROM ApexLog ORDER BY LastModifiedDate DESC Limit 1'
      )
  )
    .then(result => result.json())
    .then(responseObj => {
      if (responseObj.records && responseObj.records.length > 0) {
        const url =
          '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' +
          responseObj.records[0].Id
        if (inNewTab) {
          openInNewTab(url)
        } else {
          document.location.assign(url)
        }
      }
    })
}

getShortcuts()

shortcutMethod('l', openLastLog)
Mousetrap.bind('e', editObject)
Mousetrap.bind('s', saveObject)

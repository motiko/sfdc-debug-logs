// Service worker (manifest.json background.service_worker): opens and focuses
// the options and app tabs, and answers the content scripts' and the app's
// messages, keyed on request.command.
import { apiHostFor, isOrgHost } from '../core/org-hosts'
import { appPageUrl, appTabName, parseDisco } from '../core/app-tab'
import { createSalesforceClient } from '../core/salesforce/client'
import { createRequest } from '../core/salesforce/request'
import {
  loadPageShortcuts,
  SHORTCUTS_STORAGE_KEY
} from '../core/page-shortcuts'

// The tabs this worker opened, by name: 'options_tab', and 'app_<orgId>' for
// each org's log viewer. Their ids live in chrome.storage.session, since the
// worker's memory doesn't persist; session storage lasts as long as the
// browser session, like tab ids (storage.sync kept them across restarts and
// devices, where the same id can be another tab).
const tabStorage = chrome.storage.session

function isTabName(name: string) {
  return name === 'options_tab' || name.startsWith('app_')
}

async function tabIdFor(name: string): Promise<number | undefined> {
  const { [name]: tabId } = await tabStorage.get(name)
  return typeof tabId === 'number' ? tabId : undefined
}

function focusTab(tabId: number) {
  return chrome.tabs.get(tabId).then(tab => {
    chrome.tabs.update(tab.id, { active: true })
    chrome.windows.getCurrent({}).then(currentWindow => {
      if (tab.windowId != currentWindow.id) {
        chrome.windows.update(tab.windowId, { focused: true })
      }
    })
  })
}

chrome.tabs.onRemoved.addListener(async closedTabId => {
  const stored = await tabStorage.get(null)
  const names = Object.keys(stored).filter(
    name => isTabName(name) && stored[name] === closedTabId
  )
  if (names.length) await tabStorage.remove(names)
})

async function openOrFocusTab(url: string, name: string) {
  const tabId = await tabIdFor(name)
  if (tabId !== undefined) {
    focusTab(tabId).catch(() => openTab(url, name))
  } else {
    openTab(url, name)
  }
}

// Focuses the log viewer tab already open for this org (name: 'app_<orgId>').
// Resolves false if there is none, so the content script opens one.
async function focusAppTab(name: string | undefined): Promise<boolean> {
  if (!name || !name.startsWith('app_')) return false
  const tabId = await tabIdFor(name)
  if (tabId === undefined) return false
  return focusTab(tabId).then(
    () => true,
    async () => {
      await tabStorage.remove(name)
      return false
    }
  )
}

function openTab(url: string, name: string) {
  chrome.tabs.create({ url, active: true }, tab => {
    tabStorage.set({ [name]: tab.id })
  })
}

// Saves the page shortcuts in this version's format once, migrated from the
// list 0.8.x saved (which stays, for a downgrade). Until then (or if this
// fails), loadPageShortcuts migrates on every read, with the same result.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // First install only (not updates): a welcome on the options page, which
  // explains how to open the log viewer and where the settings are.
  if (reason === 'install') {
    openTab(chrome.runtime.getURL('html/options.html#welcome'), 'options_tab')
  }
  const { [SHORTCUTS_STORAGE_KEY]: saved } = await chrome.storage.sync.get(
    SHORTCUTS_STORAGE_KEY
  )
  if (saved) return
  await chrome.storage.sync.set({
    [SHORTCUTS_STORAGE_KEY]: await loadPageShortcuts(chrome.storage.sync)
  })
})

// The toolbar button: on a Salesforce org tab (Classic, Lightning, Lightning
// Setup) it opens that org's log viewer, or focuses it if it's open, like
// Shift+W; anywhere else (other sites, public Salesforce Sites, no session) it
// opens the options page.
async function onActionClicked(tab: { url?: string } | undefined) {
  if (!(await openAppForTab(tab))) {
    openOrFocusTab(chrome.runtime.getURL('html/options.html'), 'options_tab')
  }
}

chrome.action.onClicked.addListener(tab => {
  onActionClicked(tab)
})

// Opens (or focuses) the log viewer for the org of a tab. Resolves false,
// opening nothing, if the tab isn't on an org host or has no session. The
// tab's URL is readable because the org hosts are in host_permissions.
async function openAppForTab(
  tab: { url?: string } | undefined
): Promise<boolean> {
  const url = tab && tab.url
  let tabHost: string
  try {
    tabHost = new URL(url).hostname
  } catch (e) {
    return false
  }
  if (!isOrgHost(tabHost)) return false
  const session = await getSessionForUrl(url)
  if (!session.token) return false
  const host = session.host || apiHostFor(tabHost)
  const ids = await orgIdsFor(tabHost, host, session.token)
  openOrFocusTab(
    appPageUrl(chrome.runtime.getURL('html/app.html'), ids, {
      token: session.token,
      host
    }),
    appTabName(ids.orgId)
  )
  return true
}

// The org and user ids, from Salesforce's disco cookie (as Shift+W reads them
// on the page), or else from Salesforce's userinfo.
async function orgIdsFor(tabHost: string, apiHost: string, token: string) {
  for (const candidate of new Set([apiHost, apiHostFor(tabHost), tabHost])) {
    const cookie = await chrome.cookies.get({
      url: `https://${candidate}/`,
      name: 'disco'
    })
    const ids = parseDisco(cookie && cookie.value)
    if (ids.orgId && ids.userId) return ids
  }
  const client = createSalesforceClient(
    createRequest({
      origin: `https://${apiHost}`,
      token,
      getToken: async () => token
    })
  )
  return client.currentUser().catch(() => ({
    orgId: undefined,
    userId: undefined
  }))
}

// Returns { token, host } for a Salesforce page URL. The sid cookie is
// HttpOnly, so content scripts can't read it, but chrome.cookies can. Falls
// back to the token saved on the options page.
async function getSessionForUrl(
  url: string | undefined
): Promise<{ token: string | undefined; host: string | undefined }> {
  let host: string
  try {
    host = new URL(url).hostname
  } catch (e) {
    return { token: undefined, host: undefined }
  }
  if (!isOrgHost(host)) return { token: undefined, host: undefined }
  for (const candidate of new Set([apiHostFor(host), host])) {
    const cookie = await chrome.cookies.get({
      url: `https://${candidate}/`,
      name: 'sid'
    })
    if (cookie && cookie.value) return { token: cookie.value, host: candidate }
  }
  const { token } = await chrome.storage.local.get('token')
  return { token: token as string | undefined, host: undefined }
}

// The e2e flow (e2e/apex-logs.test.mjs) calls this from the worker's console
// to check that only org hosts get a session.
;(self as any).getSessionForUrl = getSessionForUrl
// And this one with a tab ({ url }), since it can't click the toolbar button.
;(self as any).onActionClicked = onActionClicked

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.command) {
    case 'getToken':
      // request.url: the Salesforce page the token is for (the React app
      // passes its host); otherwise the tab that sent the message.
      getSessionForUrl(request.url || (sender.tab && sender.tab.url)).then(
        sendResponse
      )
      break
    case 'getShortcuts':
      loadPageShortcuts(chrome.storage.sync).then(settings =>
        sendResponse({ settings })
      )
      break
    case 'openTab':
      chrome.tabs.create({ url: request.url })
      break
    case 'openOrFocusTab':
      openOrFocusTab(request.url, request.name)
      break
    case 'focusAppTab':
      focusAppTab(request.name).then(sendResponse)
      break
  }
  return true
})

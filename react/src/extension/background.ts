// Service worker (manifest.json background.service_worker): opens and focuses
// the options and app tabs, and answers the content scripts' and the app's
// messages, keyed on request.command.
import { apiHostFor, isOrgHost } from '../core/org-hosts'

const appTabNames = ['options_tab', 'app_tab']

function focusTab(tabId: number) {
  return chrome.tabs.get(tabId).then(tab => {
    if (tab) chrome.tabs.update(tab.id, { active: true })
    chrome.windows.getCurrent({}).then(currentWindow => {
      if (tab.windowId != currentWindow.id) {
        chrome.windows.update(tab.windowId, { focused: true })
      }
    })
  })
}

// Tab ids live in chrome.storage.sync, since the worker's memory doesn't
// persist.
chrome.tabs.onRemoved.addListener(closedTabId => {
  appTabNames.forEach(async name => {
    const tabId: any = await chrome.storage.sync.get(name)
    console.log('closedTabId', closedTabId)
    console.log('tabId', tabId)
    if (closedTabId == tabId) {
      chrome.storage.sync.set({ [name]: undefined })
    }
  })
})

async function openOrFocusTab(url: string, name: string) {
  const ids = await chrome.storage.sync.get(name)
  console.log('ids', ids)
  console.log('name', name)
  if (ids[name]) {
    focusTab(ids[name] as number).catch(() => openTab(url, name))
  } else {
    openTab(url, name)
  }
}

function openTab(url: string, name: string) {
  chrome.tabs.create({ url, active: true }, tab => {
    console.log('tab', tab)
    chrome.storage.sync.set({ [name]: tab.id })
  })
}

chrome.action.onClicked.addListener(() =>
  openOrFocusTab(chrome.runtime.getURL('html/options.html'), 'options_tab')
)

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
      chrome.storage.sync.get('shortcuts').then(({ shortcuts }) => {
        sendResponse({ shortcuts })
      })
      break
    case 'openTab':
      chrome.tabs.create({ url: request.url })
      break
    case 'openOrFocusTab':
      openOrFocusTab(request.url, request.name)
      break
    case 'focusAppTab':
      // No app tab is tracked yet, so the content script opens one with
      // openOrFocusTab. Returning false sends no response.
      return false
  }
  return true
})

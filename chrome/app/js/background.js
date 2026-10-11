/*
let appTabIds = {};
let orgVars = {};

function focusTab(tabId) {
  browser.tabs.get(tabId).then((tab) => {
    if (tab) browser.tabs.update(tab.id, {
      active: true
    })
    browser.windows.getCurrent({}).then((currentWindow) => {
      if (tab.windowId != currentWindow.id) {
        browser.windows.update(tab.windowId, {
          focused: true
        });
      }
    })
  })
}

function openOrFocusTab(url, name) {
  if (appTabIds[name]) {
    focusTab(appTabIds[name])
  } else {
    openTab(url, name)
  }
}

function openTab(url, name) {
  browser.tabs.create({
    'url': url,
    'selected': true
  }).then(tab => appTabIds[name] = tab.id);
}

browser.browserAction.onClicked.addListener(
  () => openOrFocusTab(browser.extension.getURL('html/options.html'), "options"))

browser.tabs.onRemoved.addListener((tabId, changeInfo, tab) => {
  if (Object.values(appTabIds).indexOf(tabId) > -1 ){
    Object.keys(appTabIds).filter((key)=> appTabIds[key] == tabId)
      .forEach(key => appTabIds[key] = undefined)
  }

})*/

let appTabNames = ['options_tab','app_tab']
let appTabIds = {}

function focusTab(tabId) {
  return chrome.tabs.get(tabId).then((tab) => {
    if (tab) chrome.tabs.update(tab.id, {
      active: true
    })
    chrome.windows.getCurrent({}).then((currentWindow) => {
      if (tab.windowId != currentWindow.id) {
        chrome.windows.update(tab.windowId, {
          focused: true
        });
      }
    })
  })}

chrome.tabs.onRemoved.addListener((closedTabId, changeInfo, tab) => {
  appTabNames.forEach(async (name) => {
    const tabId = await chrome.storage.sync.get(name) 
    console.log('closedTabId', closedTabId)
    console.log('tabId', tabId)
    if(closedTabId == tabId){
      chrome.storage.sync.set({
        [name]: undefined
      })
    }
  })
})

async function openOrFocusTab(url, name) {
  const ids = await chrome.storage.sync.get(name) 
  console.log('ids', ids)
  console.log('name', name)
  if (ids[name]) {
    focusTab(ids[name]).catch((err) => openTab(url, name))
  } else {
    openTab(url, name)
  }
}

function openTab(url, name) {
  chrome.tabs.create({
    'url': url,
    'selected': true
  }, function(tab) {
    console.log('tab', tab)
    chrome.storage.sync.set({
      [name]: tab.id
    })
  });
}

chrome.action.onClicked.addListener(
  () => openOrFocusTab(chrome.runtime.getURL('html/options.html'), "options_tab"))

// Lightning and Setup pages run on domains whose sid cookie isn't accepted by
// the API; the org's my.salesforce.com domain has the API session.
function apiHostFor(host) {
  return host
    .replace(/\.lightning\.force\.com$/, '.my.salesforce.com')
    .replace(/\.my\.salesforce-setup\.com$/, '.my.salesforce.com')
}

// Org (My Domain, Lightning, Setup and classic instance) hosts. The content
// scripts also run on *.force.com, which includes public Salesforce Sites that
// anyone can host, so sessions are only handed out for org hosts.
function isOrgHost(host) {
  return /\.(my\.salesforce\.com|lightning\.force\.com|my\.salesforce-setup\.com)$/.test(host) ||
    /^[a-z]{2,4}\d+\.salesforce\.com$/.test(host)
}

// Returns { token, host } for a Salesforce page URL. The sid cookie is
// HttpOnly, so content scripts can't read it, but chrome.cookies can. Falls
// back to the token saved on the options page.
async function getSession(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch (e) {
    return { token: undefined, host: undefined }
  }
  if (!isOrgHost(host)) return { token: undefined, host: undefined }
  for (const candidate of new Set([apiHostFor(host), host])) {
    const cookie = await chrome.cookies.get({ url: `https://${candidate}/`, name: 'sid' })
    if (cookie && cookie.value) return { token: cookie.value, host: candidate }
  }
  const { token } = await chrome.storage.local.get('token')
  return { token, host: undefined }
}

chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {
  switch (request.command) {
    case "getToken":
      // request.url: the Salesforce page the token is for (the React app
      // passes its host); otherwise the tab that sent the message.
      getSession(request.url || (sender.tab && sender.tab.url)).then(sendResponse)
      break
    case "getShortcuts":
      chrome.storage.sync.get('shortcuts').then(function({
        shortcuts
      }) {
        sendResponse({
          shortcuts
        })
      })
      break
    case "openTab":
      chrome.tabs.create({
        url: request.url
      })
      break
    case "openOrFocusTab":
      openOrFocusTab(request.url, request.name)
      break
    case "focusAppTab": {
      // const appTabNames = Object.keys(appTabIds).filter(tabName => tabName.startsWith("app_") )
      const appTabNames = []
      if(appTabNames.length > 0 && appTabIds[appTabNames[0]]){
        focusTab(appTabIds[appTabNames[0]])
        return true
      }
      return false
    }
  }
  return true
});

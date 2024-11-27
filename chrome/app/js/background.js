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

let appTabIds = {};

function openOrFocusTab(url, name) {
  if (appTabIds[name]) {
    focusTab(appTabIds[name])
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
    appTabIds[name] = tab.id
  });
}

chrome.action.onClicked.addListener(
  () => openOrFocusTab(chrome.runtime.getURL('html/options.html'), "options"))

chrome.runtime.onMessage.addListener((request,sender,sendResponse) => {
  console.log('request', request)
  console.log('sender', sender)
  switch (request.command) {
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
    case "focusAppTab":
      const appTabNames = Object.keys(appTabIds).filter(tabName => tabName.startsWith("app_") )
      if(appTabNames.length > 0 && appTabIds[appTabNames[0]]){
        focusTab(appTabIds[appTabNames[0]])
        return true
      }
      return false
      break
    case "updateVars":
      const { vars, sid } = request;
        console.log(request)
      if (sid && vars) {
        orgVars = {
          ...orgVars,
          [vars.oid]: {
            sessionVars: vars,
            sid
          }
        };
        console.log(orgVars)
        const tabId = appTabIds[ `app_${vars.oid}` ]
        if(tabId){
          chrome.tabs.sendMessage(tabId, request)
        }
      }
      break;
    case "getVars":
      return orgVars[request.orgId]
      break;
  }
  return true
});

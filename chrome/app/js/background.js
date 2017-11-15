let optionsTabId = ""

function openOptionsTab() {
  if (optionsTabId) {
    browser.tabs.get(optionsTabId).then((tab) => {
      if (tab) browser.tabs.update(tab.id, {
        active: true
      })
      browser.windows.getCurrent({}).then( (currentWindow) => {
        if (tab.windowId != currentWindow.id) {
          browser.windows.update(tab.windowId, {
            focused: true
          })
        }
      })
    })
  } else {
    browser.tabs.create({
      'url': browser.extension.getURL('html/options.html'),
      'selected': true
    }).then(tab => optionsTabId = tab.id);
  }
}

browser.browserAction.onClicked.addListener(openOptionsTab)

browser.tabs.onRemoved.addListener((tabId, changeInfo, tab) => {
  if (optionsTabId == tabId)
    optionsTabId = ""
})

browser.runtime.onMessage.addListener((request) => {
  switch (request.command) {
    case "openTab":
      browser.tabs.create({
        url: request.url
      })
      break
    case "openOptionsTab":
      openOptionsTab()
      break
  }
});

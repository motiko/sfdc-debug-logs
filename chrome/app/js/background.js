let appTabIds = {}

function openOptionsTab() {

}

function focusTab(tabId) {
  browser.tabs.get(tabId).then((tab) => {
    if (tab) browser.tabs.update(tab.id, {
      active: true
    })
    browser.windows.getCurrent({}).then((currentWindow) => {
      if (tab.windowId != currentWindow.id) {
        browser.windows.update(tab.windowId, {
          focused: true
        })
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

})

browser.runtime.onMessage.addListener((request) => {
  switch (request.command) {
    case "openTab":
      browser.tabs.create({
        url: request.url
      })
      break
    case "openOrFocusTab":
      openOrFocusTab(request.url, request.name)
      break
    case "ga":
      _gaq.push(request.params);
      break
  }
  return true
});

// GA
var _gaq = [];
_gaq.push(['_setAccount', 'UA-93536905-1']);

(function() {
  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js'; //'https://www.google-analytics.com/analytics.js'//
  //document.body.appendChild(ga);
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
})();

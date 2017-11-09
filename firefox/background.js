var _gaq = [];
_gaq.push(['_setAccount', 'UA-93536905-1']);
let optionsTabId = ""

function openOptionsTab() {
  if(optionsTabId){
    browser.tabs.get(optionsTabId, (tab) => {
      if(tab) browser.tabs.update(tab.id, {active: true})
      browser.windows.getCurrent({}, (currentWindow) => {
        if(tab.windowId != currentWindow.id){
          browser.windows.update(tab.windowId, {focused: true})
        }
      })
    })
  }
  else{
    browser.tabs.create({'url': browser.extension.getURL('options.html'),
      'selected': true}, (tab) => optionsTabId = tab.id);
  }
}

browser.browserAction.onClicked.addListener(openOptionsTab)

browser.tabs.onRemoved.addListener((tabId, changeInfo, tab) => {
  if(optionsTabId == tabId)
    optionsTabId = ""
})

browser.runtime.onMessage.addListener( (request) => {
  switch(request.command){
    case "openTab":
      browser.tabs.create({url: request.url});
      break
    case "ga":
      _gaq.push(request.params);
      break
    case "openOptionsTab":
      openOptionsTab()
      break
  }
 });


// GA

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js'; //'https://www.google-analytics.com/analytics.js'//
  //document.body.appendChild(ga);
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

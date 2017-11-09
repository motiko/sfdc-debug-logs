var _gaq = [];
_gaq.push(['_setAccount', 'UA-93536905-1']);
let optionsTabId = ""

function openOptionsTab() {
  if(optionsTabId){
    chrome.tabs.get(optionsTabId, (tab) => {
      if(tab) chrome.tabs.update(tab.id, {active: true})
      chrome.windows.getCurrent({}, (currentWindow) => {
        if(tab.windowId != currentWindow.id){
          chrome.windows.update(tab.windowId, {focused: true})
        }
      })
    })
  }
  else{
    chrome.tabs.create({'url': chrome.extension.getURL('options.html'),
      'selected': true}, (tab) => optionsTabId = tab.id);
  }
}

chrome.browserAction.onClicked.addListener(openOptionsTab)

chrome.tabs.onRemoved.addListener((tabId, changeInfo, tab) => {
  if(optionsTabId == tabId)
    optionsTabId = ""
})

chrome.runtime.onMessage.addListener( (request) => {
  switch(request.command){
    case "openTab":
      chrome.tabs.create({url: request.url});
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

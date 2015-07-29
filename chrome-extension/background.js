chrome.runtime.onMessage.addListener(
    function(request) {
    if(request.command === "openTab"){
        chrome.tabs.create({url: request.url});
    }
 });


var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-93536905-1']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js'; //'https://www.google-analytics.com/analytics.js'//
  //document.body.appendChild(ga);
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

chrome.runtime.onMessage.addListener(
    function(request) {
    if(request.command === "openTab"){
        chrome.tabs.create({url: request.url});
    }
    else if(request.command == "ga"){
        _gaq.push(request.params);
    }
 });

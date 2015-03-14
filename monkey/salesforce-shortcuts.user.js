// ==UserScript==
// @name         Shortcuts
// @namespace    http://your.homepage/
// @version      0.2.1
// @description  Salesforce keyboard shortcuts
// @author       motiko
// @match        https://*.force.com/*
// @match        https://*.salesforce.com/*
// @require      mousetrap.min.js
// @grant        GM_openInTab
// ==/UserScript==
(function(){

function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function sendBackUserId(){
    if(window.UserContext){
        window.postMessage({type:"userId",content:UserContext.userId},"*");
    }
}

function sendBackOrgId(){
    if(document.cookie.indexOf('oid=') > -1){
        window.postMessage({type:"orgId",content:document.cookie.substr(document.cookie.indexOf('oid=')+4,15)},"*");
    }
}

window.addEventListener("message", function(event) {
    var userId,orgId;
    if(event.data.type === "userId"){
        userId = event.data.content;
        shortcut('d',"/setup/ui/listApexTraces.apexp?user_id="+ userId+"&user_logging=true");
    }
    if(event.data.type === "orgId"){
        orgId = event.data.content;
        shortcut('i','/' + orgId);
    }
});

inject(sendBackUserId);
inject(sendBackOrgId);

shortcut('s',"/_ui/platform/schema/ui/schemabuilder/SchemaBuilderUi?setupid=SchemaBuilder");
shortcut('o',"/p/setup/custent/CustomObjectsPage");
shortcut('u',"/005?setupid=ManageUsers");
shortcut('p',"/setup/ui/profilelist.jsp?setupid=Profiles");
shortcut('c',"/01p");


function shortcut(char,url){
    Mousetrap.bind(['alt+shift+' + char],function(e){
        document.location.assign(url);
     });
    Mousetrap.bind(['shift+' + char],function(e){
        if(typeof GM_openInTab == 'function'){
            GM_openInTab(location.origin + url);
        }else{
             window.open(url,'_blank');
        }
    });
}

})();

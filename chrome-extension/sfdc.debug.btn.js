// ==UserScript==
// @name         Add Salesforce Debug Log Buttons
// @namespace    sfdc
// @version      0.1
// @description  Add Salesforce Debug Log Buttons
// @author       You
// @match       https://*.salesforce.com/setup/ui/listApexTraces.apexp*
// @require     file:///c:/sfdc-debug-logs/monkey/sfdc.debug.btn.js
// @grant unsafeWindow
// @run-at document-end
// ==/UserScript==

(function(){
var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var userName = document.getElementById('userNavLabel').innerText;
var form = document.getElementById("Apex_Trace_List:monitoredUsersForm");
var pbButton = form.getElementsByClassName('pbButton');
var deleteAllContainer = document.getElementById("Apex_Trace_List:traceForm").getElementsByClassName('pbButton')[0];
var addUserButton = document.createElement('button');
var realDeleteAll = document.createElement('button');
realDeleteAll.innerText = 'Delete All (for real)';
realDeleteAll.onclick = function(event){
    event.preventDefault();
    var xhr = new XMLHttpRequest();
   /* var apexToDel = 'delete [Select Id From ApexLog];';
    xhr.open('GET','/services/data/v30.0/tooling/executeAnonymous/?anonymousBody=' + encodeURIComponent(apexToDel));
    xhr.onload = function(result){
        console.log(this.responseText);
        debugger;
         window.location.href = window.location.href;
    }*/

    xhr.open('GET','/services/data/v30.0/tooling/query/?q=' + encodeURIComponent('Select Id From ApexLog'),true);
    xhr.onload = function(result){
        var reponseObj = JSON.parse(this.responseText);
        var logIds = reponseObj.records.map(function(logObj){
            return logObj.Id;
        });
        console.log(logIds.length);
        var logsCounter = logIds.length;
        logIds.map(function(id){
            var deleteLogs = new XMLHttpRequest();
            deleteLogs.open('DELETE','/services/data/v30.0/tooling/sobjects/ApexLog/' + id,true);
            deleteLogs.setRequestHeader('Authorization','Bearer ' + sid);
            deleteLogs.onload = function(){
                logsCounter--;
            }
            deleteLogs.send();
        });
        setInterval(function(){
            if(logsCounter == 0){
                window.location.href = window.location.href;
            }
        },1000);
    }
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.send();
}
deleteAllContainer.appendChild(realDeleteAll);
addUserButton.innerText = 'Add Current User';
addUserButton.onclick = function(event){
    event.preventDefault();
    var expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 2);
    expirationDate = expirationDate.toJSON();
    var traceFlag = {
    ApexCode : "Debug",
    ApexProfiling : "Debug",
    Callout : "Debug",
    Database : "Debug",
    TracedEntityId : unsafeWindow.UserContext.userId,
    ExpirationDate : expirationDate,
    System : "Debug",
    Validation : "Debug",
    Visualforce : "Debug",
    Workflow : "Debug"
    };
    var xhr = new XMLHttpRequest();
    xhr.open('POST','/services/data/v30.0/tooling/sobjects/TraceFlag',true);
    xhr.onload   = success;
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.send(JSON.stringify(traceFlag));
    function success(result) {
      console.log(this.responseText);
    }
    window.location.href = window.location.href;
}
pbButton[0].appendChild(addUserButton);
})();

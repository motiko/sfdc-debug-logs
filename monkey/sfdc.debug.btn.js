// ==UserScript==
// @name         Add Salesforce Debug Log Buttons
// @namespace    sfdc
// @version      0.1
// @description  Add Salesforce Debug Log Buttons
// @author       You
// @match       https://*.salesforce.com/setup/ui/listApexTraces.apexp*
// @require     file:///c:/sfdc-debug-logs/monkey/sfdc.debug.btn.js
// @run-at document-end
// ==/UserScript==

(function(){

var userId;
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

window.addEventListener("message", function(event) {
    if(event.data.type === "userId"){
        userId = event.data.content;
    }
});

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var userName = document.getElementById('userNavLabel').innerText;
var form = document.getElementById("Apex_Trace_List:monitoredUsersForm");
var pbButton = form.querySelector('.pbButton');
var deleteAllContainer = document.getElementById("Apex_Trace_List:traceForm").querySelector('.pbButton');
var addUserButton = document.createElement('input');
var realDeleteAll = document.createElement('input');
realDeleteAll.type = 'button';
realDeleteAll.className = 'btn';
realDeleteAll.value = 'Delete All (for real)';
realDeleteAll.onclick = function(event){
    event.preventDefault();
    document.body.style.cursor = 'wait';
    var xhr = new XMLHttpRequest();
    xhr.open('GET','/services/data/v32.0/tooling/query/?q=' + encodeURIComponent('Select Id From ApexLog'),true);
    xhr.onload = function(result){
        var reponseObj = JSON.parse(this.responseText);
        var logIds = reponseObj.records.map(function(logObj){
            return logObj.Id;
        });
        console.log(logIds.length);
        var logsCounter = logIds.length;
        logIds.map(function(id){
            var deleteLogs = new XMLHttpRequest();
            deleteLogs.open('DELETE','/services/data/v32.0/tooling/sobjects/ApexLog/' + id,true);
            deleteLogs.setRequestHeader('Authorization','Bearer ' + sid);
            deleteLogs.onload = function(){
                logsCounter--;
            }
            deleteLogs.send();
        });
        setInterval(function(){
            if(logsCounter == 0){
                document.body.style.cursor = 'deafult';
                window.location.href = window.location.href;
            }
        },1000);
    }
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.send();
}

deleteAllContainer.appendChild(realDeleteAll);
addUserButton.type = 'button';
addUserButton.className = 'btn';
addUserButton.value = 'Add Current User';

addUserButton.onclick = addCurrentUser;

function addCurrentUser(event){
    if(event){
        event.preventDefault();
    }
    var findTracedUser = new XMLHttpRequest();
    var query = "Select Id From TraceFlag Where TracedEntityId = '" + userId + "'";
    findTracedUser.open('GET','/services/data/v32.0/tooling/query/?q=' +
                encodeURIComponent(query));
    findTracedUser.onload = function(e){
        console.log(this.responseText);
        var response = JSON.parse(this.responseText);
        var oldRecords = response.size;
        if(oldRecords > 0){
            var deleteTraceFlags = new XMLHttpRequest();
            response.records.map(function(record){
                deleteTraceFlags.open('DELETE',record.attributes.url);
                deleteTraceFlags.setRequestHeader('Authorization','Bearer ' + sid);
                deleteTraceFlags.setRequestHeader('Content-Type','application/json');
                deleteTraceFlags.onload = function(e){
                    console.log(this.responseText);
                    oldRecords--;
                    if(oldRecords == 0){
                        console.log('all removed;');
                        traceUser();
                    }
                }
                deleteTraceFlags.send();
            });
        }else{
            traceUser();
        }
    }
    findTracedUser.setRequestHeader('Authorization','Bearer ' + sid);
    findTracedUser.setRequestHeader('Content-Type','application/json');
    findTracedUser.send();
}

function traceUser(event){
     if(event){
        event.preventDefault();
    }
    var expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + 1000*60*60*24);
    expirationDate = expirationDate.toJSON();
    console.log(expirationDate);
    var traceFlag = {
    ApexCode : "Debug",
    ApexProfiling : "Debug",
    Callout : "Debug",
    Database : "Debug",
    TracedEntityId : userId,
    ExpirationDate : expirationDate,
    System : "Debug",
    Validation : "Debug",
    Visualforce : "Debug",
    Workflow : "Debug"
    };
    var traceUserRequest = new XMLHttpRequest();
    traceUserRequest.open('POST','/services/data/v32.0/tooling/sobjects/TraceFlag',true);
    traceUserRequest.onload   =  function response(result) {
      console.log(this.responseText);
      window.location.href = window.location.href.split('?')[0];
    };
    traceUserRequest.setRequestHeader('Authorization','Bearer ' + sid);
    traceUserRequest.setRequestHeader('Content-Type','application/json');
    traceUserRequest.send(JSON.stringify(traceFlag));
}

pbButton.appendChild(addUserButton);

})();
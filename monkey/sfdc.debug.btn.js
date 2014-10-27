(function(){
/*var deleteAllLogsApex = ['List<ApexLog> allLogs = [Select Id From ApexLog];',
                        'delete allLogs;'].join('\n');*/
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
    xhr.open('GET','/services/data/v30.0/tooling/query/?q=' + encodeURIComponent('Select Id From ApexLog'),true);
    xhr.onload = function(result){
        debugger;
        console.log(this.responseText);
        var reponseObj = JSON.parse(this.responseText);
        var logIds = reponseObj.records.map(function(logObj){
            return logObj.Id;
        });
        console.log(logIds.length);
        logIds.map(function(id){
            var deleteLogs = new XMLHttpRequest();
            deleteLogs.open('DELETE','/services/data/v30.0/tooling/sobjects/ApexLog/' + id,true);
            deleteLogs.setRequestHeader('Authorization','Bearer ' + sid);
            deleteLogs.send();
        });
        window.location.href = window.location.href;
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

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

})();

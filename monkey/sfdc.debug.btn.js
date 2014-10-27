var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var userName = document.getElementById('userNavLabel').innerText;
var form = document.getElementById("Apex_Trace_List:monitoredUsersForm");
var pbButton = form.getElementsByClassName('pbButton');
var newButton = document.createElement('button')
newButton.innerText = 'Add Current User';
debugger;
newButton.onclick = function(event){
    event.preventDefault();
    var expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 2);
    expirationDate = expirationDate.toJSON();
    var traceFlag = {
    ApexCode : "Debug",
    ApexProfiling : "Debug",
    Callout : "Debug",
    Database : "Debug",
    TracedEntityId : "00520000003Zqvm",
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
      debugger;
      console.log(this.responseText);
    }
}
pbButton[0].appendChild(newButton);

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


/*

 {
    "ApexCode" : "Debug",
    "ApexProfiling" : "Debug",
    "Callout" : "Debug",
    "Database" : "Debug",
    "ExpirationDate" : "2014-10-27T08:22:25.876Z",
    "System" : "Debug",
    "TracedEntityId" : "00520000003Zqvm",
    "Validation" : "Debug",
    "Visualforce" : "Debug",
    "Workflow" : "Debug"
}
*/
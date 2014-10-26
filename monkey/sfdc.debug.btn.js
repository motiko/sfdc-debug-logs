var form = document.getElementById("Apex_Trace_List:monitoredUsersForm");
var pbButton = form.getElementsByClassName('pbButton');
var newButton = document.createElement('button')
newButton.innerText = 'Add Current User';
newButton.onclick = function(){
    var oReq = new XMLHttpRequest();
    oReq.onload = reqListener;
    oReq.open("POST", "/p/setup/layout/AddApexDebugLogUser", true);
    oReq.send();
    /*
    window.location.href = 'https://emea.salesforce.com/p/setup/layout/AddApexDebugLogUser?retURL=%2Fsetup%2Fui%2FlistApexTraces.apexp&cur=1';
    return false;*/
}

pbButton[0].appendChild(newButton);
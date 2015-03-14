(function(){

var userId;
var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

initPage();

function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function initPage(){
    getUserId();
    addDeleteAllBtn();
    addAddUserBtn();
    addSearchControllers();
}

function getUserId(){
    window.addEventListener("message", function(event) {
        if(event.data.type === "userId"){
            userId = event.data.content;
        }
    });
    inject(sendBackUserId);
    function sendBackUserId(){
        if(window.UserContext){
            window.postMessage({type:"userId",content:UserContext.userId},"*");
        }
    }
}

function addAddUserBtn(){
    var pbButton = document.getElementById("Apex_Trace_List:monitoredUsersForm").querySelector('.pbButton');
    var addUserButton = document.createElement('input');
    addUserButton.type = 'button';
    addUserButton.className = 'btn';
    addUserButton.value = 'Add Current User';
    addUserButton.onclick = addCurrentUser;
    pbButton.appendChild(addUserButton);
}

function addDeleteAllBtn(){
    var deleteAllContainer = document.getElementById("Apex_Trace_List:traceForm").querySelector('.pbButton');
    var realDeleteAllBtn = document.createElement('input');
    realDeleteAllBtn.type = 'button';
    realDeleteAllBtn.className = 'btn';
    realDeleteAllBtn.value = 'Delete All (for real)';
    realDeleteAllBtn.onclick = realDeleteAll;
    deleteAllContainer.appendChild(realDeleteAllBtn);
}

function realDeleteAll(event){
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
            };
            deleteLogs.send();
        });
        setInterval(function(){
            if(logsCounter === 0){
                document.body.style.cursor = 'deafult';
                window.location.href = window.location.href;
            }
        },1000);
    };
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.send();
}

function addCurrentUser(event){
    if(event){
        event.preventDefault();
    }
    document.location.assign("/setup/ui/listApexTraces.apexp?user_id="+ userId+"&user_logging=true");
}

function addSearchControllers(){
    var iframe = document.createElement('iframe');
    iframe.id = 'remember';
    iframe.name = 'remember';
    iframe.style.display = 'none';
    iframe.src = 'about:blank';
    document.body.appendChild(iframe);
    var form = document.createElement('form');
    form.method = 'post';
    form.target = 'remember';
    form.action = 'about:blank';
    form.onsubmit = filterLogByText;
    var input = document.createElement('input');
    input.type ='text';
    input.id = 'FilterByText';
    input.autocomplete = 'on';
    input.onkeydown = handleSearchKey;
    var filter = document.createElement('button');
    filter.innerText = 'Search';
    filter.type = 'submit';
    var clearFilterBtn = document.createElement('button');
    clearFilterBtn.innerText = 'Clear';
    clearFilterBtn.onclick = clearFilter;
    var loadingImage = document.createElement('img');
    loadingImage.src = '/img/loading.gif';
    loadingImage.style.display = 'none';
    loadingImage.id = 'LoadinImage';
    form.appendChild(input);
    form.appendChild(filter);
    form.appendChild(clearFilterBtn);
    form.appendChild(loadingImage);
    var logsTitle = document.querySelector('.apexp .pbTitle');
    logsTitle.appendChild(form);
}

function handleSearchKey(e){
    if(e.keyCode == 27){
        clearFilter(e);
    }
}

function clearFilter(e){
    e.preventDefault();
    document.getElementById('FilterByText').value = '';
    resetResults();
}

function resetResults(){
    var logTableRows = [].slice.call(document.
            getElementById('Apex_Trace_List:traceForm:traceTable:thetracetable:tb').children).forEach(function(element){
                element.style.background = 'white';
            });
}

function filterLogByText(e){
    resetResults();
    document.body.style.cursor = 'wait';
    document.getElementById('LoadinImage').style.display = 'inline';
    var searchText = document.getElementById('FilterByText').value;
    var searchRegex = new RegExp(escapeRegExp(searchText),'gi');
    var logTableRows = [].slice.call(document.getElementById('Apex_Trace_List:traceForm:traceTable:thetracetable:tb').children);
    var visibleLogRows = logTableRows.map(function(row){
         var link = row.querySelector('td>a').href; // consider for perfomance: row.children[0].children[0]
         logIdParam = link.split('?')[1].split('&').filter(function(keyVal){
            return keyVal.indexOf('apex_log_id=') === 0;
         });
         logIdParam = logIdParam[0];
         return {element :row,
                id:logIdParam.split('=')[1]};
    });
    var queriesLeft = visibleLogRows.length;
    visibleLogRows.forEach(function(logRow){
        get('/services/data/v32.0/tooling/sobjects/ApexLog/'+ logRow.id +'/Body').then(function(rawLogContents){
            queriesLeft--;
            if(queriesLeft === 0){
                document.body.style.cursor = 'default';
                document.getElementById('LoadinImage').style.display = 'none';
            }
            if(searchRegex.test(rawLogContents)){
                logRow.element.style.background = 'rgb(104, 170, 87)';
            }
        });
    });
}

function get(url){
    return new Promise(function(fulfill,reject){
        var request = new XMLHttpRequest();
        request.open('GET',url);
        request.onload = function(){
            if(request.status == 200){
                fulfill(request.response);
            }else{
                reject(Error(request.statusText));
            }
        };

        request.onerror = function(){
            rejected(Error("Network Error"));
        };
        request.setRequestHeader('Authorization','Bearer ' + sid);
        request.send();
    });
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

})();
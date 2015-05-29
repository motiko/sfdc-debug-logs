// ==UserScript==
// @name         Add Salesforce Debug Log Buttons
// @namespace    SFDC
// @version      0.3.0
// @description  Add Salesforce Debug Log Buttons
// @author       motiko
// @match       https://*.salesforce.com/setup/ui/listApexTraces.apexp*
// @grant GM_xmlhttpRequest
// @run-at document-end
// ==/UserScript==
/*eslint new-cap:0*/
/*global GM_xmlhttpRequest*/
(function(){

var userId;
var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

const LOGS_TABLE_ID = 'Apex_Trace_List:traceForm:traceTable:thetracetable:tb';
const LOGS_TABLE_ID_ESCAPED = LOGS_TABLE_ID.replace(/:/g, '\\:');
const USERS_TABLE_ID = 'Apex_Trace_List:monitoredUsersForm';
var showLogsNum = 50;
var tableElement = document.getElementById(LOGS_TABLE_ID);



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
    removeOldDeleteBtn();
    addAddUserBtn();
    addReloadControllers();
    addSearchControllers();
}

initPage();

function removeOldDeleteBtn(){
  var oldButtons = document.querySelectorAll('[value="Delete All"]');
  toArray(oldButtons).forEach(function(button){
    button.parentNode.removeChild(button);
  });
}

function getUserId(){
    window.addEventListener("message", function(event) {
        if(event.data.type === "userId"){
            userId = event.data.content;
        }
    });
    function sendBackUserId(){
        if(window.UserContext){
            window.postMessage({type: `userId`, content: UserContext.userId}, "*");
        }
    }
    inject(sendBackUserId);
}

function addAddUserBtn(){
    var pbButton = document.getElementById(USERS_TABLE_ID).querySelector('.pbButton');
    var addUserButton = document.createElement('input');
    addUserButton.type = 'button';
    addUserButton.className = 'btn';
    addUserButton.value = 'Add Current User';
    addUserButton.onclick = addCurrentUser;
    pbButton.appendChild(addUserButton);
}

function addReloadControllers(){
    var reloadIntervalId;
    loadLogs().then(function(){
        reloadIntervalId = setInterval(loadNewLogs, 3000);
    });
    setInterval(function(){
        request("/setup/ui/listApexTraces.apexp?user_id=" + userId
                + "&user_logging=true");
    }, 30000);
    document.getElementById('Apex_Trace_List:traceForm:traceTableNextPrev').style.display = 'none';
    document.getElementById('Apex_Trace_List:traceForm:traceTable').querySelector('.mainTitle').style.display = 'none';
    var autoReloadLabel = document.createElement('label');
    autoReloadLabel.style.float = 'right';
    autoReloadLabel.style.paddingLeft = '5px';
    autoReloadLabel.innerHTML = '<input type="checkbox" name="checkbox" id="autoReload" checked/>Auto Reload';
    autoReloadLabel.firstElementChild.onchange = function(){
        if(this.checked){
            reloadIntervalId = setInterval(loadNewLogs, 1000);
        }else{
            clearInterval(reloadIntervalId);
        }
    };
    var numOfLogsLabel = document.createElement('label');
    numOfLogsLabel.style.float = 'right';
    numOfLogsLabel.innerHTML = `Logs per Page:&nbsp;<input type="number" min="10" max="1000" value="${showLogsNum}" >`;
    numOfLogsLabel.firstElementChild.onchange = function(){
        showLogsNum = this.value;
        loadLogs();
    };
    document.getElementById("Apex_Trace_List:traceForm").querySelector('.pbButton').appendChild(autoReloadLabel);
    document.getElementById("Apex_Trace_List:traceForm").querySelector('.pbButton').appendChild(numOfLogsLabel);
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
    request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent('Select Id From ApexLog')).then(function(result){
        var reponseObjects = JSON.parse(result);
        var logIds = reponseObjects.records.map(function(logObj){
            return logObj.Id;
        });
        var logsCounter = logIds.length;
        logIds.map(function(id){
            request('/services/data/v32.0/tooling/sobjects/ApexLog/' + id, 'DELETE').then(function(){
                logsCounter--;
                if(logsCounter === 0){
                    document.body.style.cursor = 'deafult';
                    window.location.href = window.location.href;
                }
            });
        });
    });
}

function loadedLogIds(){
    var trs = toArray(document.getElementById(LOGS_TABLE_ID).children);
    return trs.map(function(tr){
        var td = tr.firstElementChild;
        var a = td.firstElementChild;
        var params = a.href.split('=');
        var id = params.pop();
        return id;
    });
}

function getMonitoredUsers(){
    return toArray(document.querySelectorAll('th[scope="row"]')).map(function(th){
        var href = th.firstElementChild.href;
        return "'" + href.substr(href.lastIndexOf('/') + 1) + "'";
    }).join(',');
}

function loadNewLogs(){
    console.log(2);
    var oldLogIds = loadedLogIds();
    requestLogs().then(function(logs){
        console.log('oldLogIds length :' + oldLogIds.length);
        console.log('oldLogIds :' + oldLogIds);
        console.log('logIds :' + logs.map( function(log){
            return log.Id;
        }) );
        var deltaLogs = logs.filter(function(log){
            return oldLogIds.indexOf(log.Id) === -1;
        });
        console.log('delatlogs length :' + deltaLogs.length);

        var deltaLogTrs = deltaLogs.map(logRecordToTr);
        deltaLogTrs.forEach(addToTable);
        animateTrsAddition(deltaLogTrs);
        removeOldLogs();
    });
}

function removeOldLogs(){
    var oldTrs = toArray(document.querySelectorAll(`#${LOGS_TABLE_ID_ESCAPED} tr:nth-child(n+${parseInt(showLogsNum, 10) + 1})`));
    animateTrsRemoval(oldTrs);
    setTimeout(function(){
        [].map.call(oldTrs, function(tr){
            try{
                tableElement.removeChild(tr);
            }catch(e){
                console.log('race?');
            }
        });
    }, 1000);
}


function loadLogs(event){
    if(event){
        event.preventDefault();
    }
    clearTable();
    return requestLogs().then(function(logs){
        console.log(1);
        logs.reverse().map(logRecordToTr).forEach(addToTable);
    });
}

function addToTable(tr){
    if(tableElement.firstChild){
        tableElement.insertBefore(tr, tableElement.firstChild);
    }else{
        tableElement.appendChild(tr);
    }
}

function requestLogs(){
    var monitoredUsers = getMonitoredUsers();
    var selectQuery = ['Select LogUser.Name,Application,DurationMilliseconds,Id,LastModifiedDate,Location,LogLength,LogUserId,',
                      `Operation,Request,StartTime,Status,SystemModstamp From ApexLog Where LogUserId in (${monitoredUsers}) ORDER BY LastModifiedDate DESC LIMIT ${showLogsNum}`].join('');
    return request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent(selectQuery))
        .then(function(rawResult){
            return JSON.parse(rawResult).records;
        }).catch(function(err){
            console.log(err);
        });
}

function animateTrsRemoval(trs){
    trs.forEach(function(tr){
        [].map.call(tr.children, function(td){
            td.className = '';
            td.style.padding = '0px';
        });
        tr.style.fontSize = '0px';
        tr.style.padding = '0px !important';
        tr.style.height = '0px';
    });
}

function animateTrsAddition(trs){
    prepareTransition(trs);
    setTimeout(function makeTransition(){
        trs.forEach(function(tr){
          tr.style.height = '23px';
        });
    }, 0);
    setTimeout(function finishTransition(){
        trs.forEach(function(tr){
          tr.style.fontSize = '12px';
          [].map.call(tr.children, function(td, i){
              td.className = i === 0 ? 'dataCell  actionColumn' : 'dataCell';
              td.style.padding = '';
          });
        });
    }, 1000);
}

function prepareTransition(logTrs){
  logTrs.forEach(function(tr){
        tr.style.fontSize = '0px';
        tr.style.padding = '0px !important';
        tr.style.height = '0px';
        [].map.call(tr.children, function(td){
            td.className = '';
            td.style.padding = '0px';
        });
    });
}

function logRecordToTr(logObj){
    var tr = document.createElement('tr');
    tr.style.webkitTransition = 'all 1000ms';
    tr.style.mozTransition = 'all 1000ms';
    tr.style.transition = 'all 1000ms';
    tr.style.height = '23px';
    tr.onfocus = "if (window.hiOn){hiOn(this);}";
    tr.dataset.id = logObj.Id;
    var startTime = new Date(Date.parse(logObj.StartTime)).toLocaleString();
    tr.innerHTML = `<td class="dataCell  actionColumn" colspan="1">
        <a href="/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${logObj.Id}" class="actionLink">View</a>&nbsp;|&nbsp;<a href="/servlet/servlet.FileDownload?file=${logObj.Id}" class="actionLink">Download</a>&nbsp;|&nbsp;<a class="actionLink deleteActionLink" href="#" >Delete</a></td>
        <td class="dataCell" colspan="1"><a  href="/{logObj.LogUserId}" class="actionLink">${logObj.LogUser.Name}</a></td>
        <td class="dataCell" colspan="1">${logObj.Request}</td>
        <td class="dataCell" colspan="1">${logObj.Application}</td>
        <td class="dataCell" colspan="1">${logObj.Operation}</td>
        <td class="dataCell" colspan="1">${logObj.Status}</td>
        <td class="dataCell" colspan="1">${logObj.DurationMilliseconds}</td>
        <td class="dataCell" colspan="1">${logObj.LogLength}</td>
        <td class="dataCell" colspan="1">${startTime}</td>`;
    return tr;
}

function clearTable(){
    document.getElementById(LOGS_TABLE_ID).innerHTML = '';
}

function addCurrentUser(event){
    if(event){
        event.preventDefault();
    }
    document.location.assign("/setup/ui/listApexTraces.apexp?user_id=" + userId + "&user_logging=true");
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
    form.action = '/';
    form.onsubmit = searchLogs;
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'FilterByText';
    input.autocomplete = 'on';
    input.placeholder = 'Search logs..';
    input.onkeydown = handleSearchKey;
    var filter = document.createElement('button');
    filter.textContent = 'Search';
    filter.type = 'submit';
    var clearFilterBtn = document.createElement('button');
    clearFilterBtn.textContent = 'Clear';
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
    if(e.keyCode === 27){
        clearFilter(e);
    }
}

function clearFilter(e){
    e.preventDefault();
    document.getElementById('FilterByText').value = '';
    resetResults();
}

function resetResults(){
    toArray(document.getElementById(LOGS_TABLE_ID).children)
            .forEach(function(element){
                element.style.background = 'white';
            });
}

function toArray(nodeElements){
    return [].slice.call(nodeElements);
}

function searchLogs(){
    document.getElementById('autoReload').checked = false;
    resetResults();
    document.body.style.cursor = 'wait';
    document.getElementById('LoadinImage').style.display = 'inline';
    var searchText = document.getElementById('FilterByText').value;
    var searchRegex = new RegExp(escapeRegExp(searchText), 'gi');
    var logTableRows = toArray(document.getElementById(LOGS_TABLE_ID).children);
    var visibleLogRows = logTableRows.map(function(row){
        if(!row.querySelector('td>a')){
            return null;
        }
        // consider for perfomance: row.children[0].children[0]
        var link = row.querySelector('td>a').href;
        logIdParam = link.split('?')[1].split('&').filter(function(keyVal){
            return keyVal.indexOf('apex_log_id=') === 0;
        });
        logIdParam = logIdParam[0];
        return { element: row,
                id: logIdParam.split('=')[1]};
    }).filter(function(e){return e; });
    var promises = visibleLogRows.map(function(logRow){
        return request('/services/data/v32.0/tooling/sobjects/ApexLog/' +
                logRow.id + '/Body')
                .then(function(rawLogContents){
            if(searchRegex.test(rawLogContents)){
                logRow.element.style.background = 'rgb(104, 170, 87)';
                return true;
            }
            return false;
        }).catch(function(err){
            console.log(err);
            document.body.style.cursor = 'default';
            document.getElementById('LoadinImage').style.display = 'none';
        });
    });
    Promise.all(promises).then(function(){
        document.body.style.cursor = 'default';
        document.getElementById('LoadinImage').style.display = 'none';
        document.getElementById('autoReload').checked = true;
    });
}

function request(url, method){
    method = method || 'GET';
    if(typeof GM_xmlhttpRequest === "function"){
        return new Promise(function(fulfill, reject){
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: {
                    Authorization: 'Bearer ' + sid,
                    Accept: '*/*'
                },
                onload: function(response){
                    if( response.status.toString().indexOf('2') === 0){
                        fulfill(response.response);
                    }else{
                        reject(Error(response.statusText));
                    }
                },
                onerror: function(){
                    reject(Error("Network Error"));
                }
            });
        });
    }
    return new Promise(function(fulfill, reject){
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function(){
            if( xhr.status.toString().indexOf('2') === 0){
                fulfill(xhr.response);
            }else{
                reject(Error(xhr.statusText));
            }
        };
        xhr.onerror = function(){
            reject(Error("Network Error"));
        };
        xhr.setRequestHeader('Authorization', 'Bearer ' + sid);
        xhr.send();
    });
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

})();

/*eslint new-cap:0*/
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
    document.getElementById('Apex_Trace_List:traceForm:traceTableNextPrev')
      .style.display = 'none';
    document.getElementById('Apex_Trace_List:traceForm:traceTable')
      .querySelector('.mainTitle').style.display = 'none';
    var numOfLogsLabel = document.createElement('label');
    numOfLogsLabel.style.float = 'right';
    numOfLogsLabel.innerHTML = `Maximum logs per Page:&nbsp;` +
      `<input type="number" min="25" max="1000" step="25" value="${showLogsNum}" >`;
    numOfLogsLabel.firstElementChild.onchange = function(){
        showLogsNum = this.value;
        loadLogs();
    };
    document.getElementById("Apex_Trace_List:traceForm")
      .querySelector('.pbButton').appendChild(numOfLogsLabel);
}

function addDeleteAllBtn(){
    var deleteAllContainer = document.getElementById("Apex_Trace_List:traceForm")
      .querySelector('.pbButton');
    var realDeleteAllBtn = document.createElement('input');
    realDeleteAllBtn.type = 'button';
    realDeleteAllBtn.className = 'btn';
    realDeleteAllBtn.value = 'Delete All ';
    realDeleteAllBtn.onclick = realDeleteAll;
    deleteAllContainer.appendChild(realDeleteAllBtn);
    var loadNewLogsBtn = document.createElement('input');
    loadNewLogsBtn.type = 'button';
    loadNewLogsBtn.className = 'btn';
    loadNewLogsBtn.value = 'Load New Logs';
    loadNewLogsBtn.onclick = loadNewLogs;
    deleteAllContainer.appendChild(loadNewLogsBtn);
}

function realDeleteAll(event){
    event.preventDefault();
    document.body.style.cursor = 'wait';

    request('/services/data/v32.0/tooling/query/?q='
            + encodeURIComponent('Select Id From ApexLog'))
        .then(function(reponse){
            reponseObject = response.json()
            var logIdsCsv = reponseObject.records.map(function(logObj){
                        return `"${logObj.Id}"`;
                    }).reduce(function(sum, id){
                        return sum + '\n' + id;
                    }, '"Id"');
            return createJob('ApexLog', 'delete').then(function(jobId){
                createBatch(jobId, logIdsCsv).then(function(batchId){
                    pollBatchStatus(jobId, batchId).then(function(){
                        location.reload();
                    });
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
    var oldLogIds = loadedLogIds();
    requestLogs().then(function(logs){
        var deltaLogs = logs.filter(function(log){
            return oldLogIds.indexOf(log.Id) === -1;
        });
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
        logs.map(logRecordToTr).forEach(addToTable);
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
    var selectQuery = [`SELECT LogUser.Name,Application,DurationMilliseconds,`,
                      `Id,LastModifiedDate,Location,LogLength,LogUserId,`,
                      `Operation,Request,StartTime,Status,SystemModstamp From `,
                      `ApexLog Where LogUserId in (${monitoredUsers}) ORDER BY `,
                        `LastModifiedDate ASC LIMIT ${showLogsNum}`].join('');
    return request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent(selectQuery))
        .then(response => response.json())
        .then(responseObj => responseObj.records)
        .catch(function(err){
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
    tr.style.webkitTransition = 'all 500ms';
    tr.style.mozTransition = 'all 500ms';
    tr.style.transition = 'all 500ms';
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
    if(event) event.preventDefault();
    const logLevelName = "ApexDebugger"
    const headers = {"Content-Type": 'application/json; charset=UTF-8', "Authorization": 'Bearer ' + sid,
        "Accept": "*/*"}
    const query = encodeURI("Select Id From DebugLevel Where DeveloperName = '" + logLevelName + "'")
    var debugLevelPayload =  {DeveloperName: logLevelName,MasterLabel: logLevelName,
      Workflow: 'DEBUG', Validation: 'DEBUG', Callout: 'DEBUG',
        ApexCode: 'DEBUG', ApexProfiling: 'DEBUG', Visualforce: 'DEBUG',
        System: 'DEBUG', Database: 'DEBUG'}
    return fetch(`/services/data/v36.0/tooling/query?q=${query}`,{headers})
      .then(res => res.json())
      .then(existingDebugLevel => {
          if(existingDebugLevel.records.length > 0){
            return existingDebugLevel.records[0].Id
          }else{
            return fetch('/services/data/v36.0/tooling/sobjects/DebugLevel',{ method: 'POST',
                  headers,
                  body: JSON.stringify(debugLevelPayload)}).then(res => res.json().then( result => result.id))
          }
      }).then(dlId => {
          var payload = {TracedEntityId: userId, DebugLevelId: dlId, LogType: 'USER_DEBUG'};
          fetch('/services/data/v36.0/tooling/sobjects/TraceFlag/',{method:'POST',
                headers: headers,body: JSON.stringify(payload)}).then(function(res){
                  res.json().then(r => console.log(r))
                })
      })
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
      .then( response => response.text())
      .then( rawLogContents => {
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
    });
}

function createJob(objectName, operation){
    var queryJob = `<?xml version="1.0" encoding="UTF-8"?>
     <jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
          <operation>${operation}</operation>
          <object>${objectName}</object>
          <concurrencyMode>Parallel</concurrencyMode>
          <contentType>CSV</contentType>
     </jobInfo>`;
    return bulkRequest('/services/async/34.0/job', 'POST',
            {'Content-Type': 'application/xml'},
            queryJob ).then(function(response){
                   return response.match(/<id>(.*)<\/id>/)[1];
               });
}

function pollBatchStatus(jobId, batchId){
    return new Promise(function(resolve, reject){
    var intervalId = setInterval(function(){
            checkBatchStatus(jobId, batchId).then(function(state){
                console.log(state);
                if(state === "Completed"){
                    resolve(state);
                    clearInterval(intervalId);
                }
                if(state === "Error" || state === "Not Processed"){
                    reject(state);
                    clearInterval(intervalId);
                }

            });

        }, 1000);
    });
}

function checkBatchStatus(jobId, batchId){
    return bulkRequest(`/services/async/34.0/job/${jobId}/batch/${batchId}`)
        .then(function(resultXml){
            return resultXml.match(/<state>(.*)<\/state>/)[1];
        });
}

function createBatch(jobId, csv){
    return bulkRequest(`/services/async/34.0/job/${jobId}/batch`, 'POST',
            {'Content-Type': 'text/csv; charset=UTF-8'},
            csv ).then(function(response){
                   return response.match(/<id>(.*)<\/id>/)[1];
               });
}

function bulkRequest(url, method = 'GET', headers, body){
  return fetch(location.origin + url, {method: method, body: body,
    headers: Objcet.assign({
      'X-SFDC-Session': sid
    },headers)}).then(result => {
      if(result.ok){
        return result.text()
      }else{
        throw Error('Not OK')
      }
    })
  }

function request(url, method = 'GET'){
  return fetch(location.origin + url, {method: method,
    headers: {'Authorization': 'Bearer ' + sid}
  }).then(result => {
    if(result.ok){
      return result
    }else{
      throw Error('Not OK')
    }
  })
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

})();

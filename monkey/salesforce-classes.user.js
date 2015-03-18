// ==UserScript==
// @name         Manage classes log level
// @namespace    SFDC
// @version      0.2.2
// @description Beautify Salesforce Debug View
// @author       motiko
// @match        https://*.salesforce.com/01p*
// @grant    GM_setValue
// @grant    GM_getValue
// @grant    GM_xmlhttpRequest
// @run-at document-end
// ==/UserScript==
(function(){

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

addHeader();
addCheckboxes();
addButton();

function addButton(){
    var seeAllClasses = document.createElement('input');
    seeAllClasses.value = 'See All Classes';
    seeAllClasses.className = 'btn';
    seeAllClasses.type = 'button';
    seeAllClasses.onclick = function(){
        if(location.search.indexOf('rowsperpage=') > -1){
            window.location.search = 'setupid=ApexClasses&' + encodeURIComponent('all_classes_page:theTemplate:classList:rowsperpage') + '=3500';
        }
        else{
            window.location.search += '&' + encodeURIComponent('all_classes_page:theTemplate:classList:rowsperpage') + '=3500';
        }
    };
    document.getElementById('all_classes_page:theTemplate:theForm').querySelector('td').appendChild(seeAllClasses);
}


function addHeader(){
    var header = document.createElement('th');
    header.textContent = 'Dont Log Class';
    var selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.onclick = function(event){
        var checkedStatus = this.checked;
        toArray(document.querySelectorAll('.dontLog')).forEach(function(cbDontLog){
            if(cbDontLog.checked != checkedStatus){
                cbDontLog.checked = checkedStatus;
                cbDontLog.onclick();
            }
        });
    };
    header.appendChild(selectAll);
    header.appendChild(createLoadingImage());
    document.querySelector('.headerRow').appendChild(header);
}

function createLoadingImage(){
    var loadingImage = document.createElement('img');
    loadingImage.src = '/img/loading.gif';
    loadingImage.style.display = 'none';
    loadingImage.className = 'LoadinImage';
    return loadingImage;
}

function addCheckboxes(){
    var cell = document.createElement('td');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dontLog';
    cell.appendChild(checkbox);
    cell.appendChild(createLoadingImage());
    var dataRows = toArray(document.querySelectorAll('.dataRow'));
    dataRows.forEach(function(row){
        setTimeout(function(){addCheckbox(row,cell);},0);
    });
}

function addCheckbox(row,cell){
    var clone = cell.cloneNode(true);
    var classLink = row.querySelector('th>a').href;
    var classId = classLink.slice(classLink.lastIndexOf('/01p')+1);
    var isChecked = row.querySelector('td>img').title === "Checked";
    clone.firstChild.dataset.classId = classId;
    clone.firstChild.onclick = toggleTraceFlag;
    clone.firstChild.checked = isChecked;
    row.appendChild(clone);
}

function toggleTraceFlag(event){
    var noLog = {Workflow: 'NONE',Validation: 'NONE',Callout: 'NONE',ApexCode: 'NONE',ApexProfiling: 'NONE',Visualforce: 'NONE',System: 'NONE',Database: 'NONE'};
    var checkbox = this;
    var classId = checkbox.dataset.classId;
    var dontLog = checkbox.checked;
    checkbox.parentNode.children[1].style.display = 'inline';
    noLog.TracedEntityId = classId;
    if(dontLog){
        request('/services/data/v32.0/tooling/sobjects/TraceFlag/','POST',JSON.stringify(noLog),'application/json').then(function(){
            checkbox.parentNode.children[1].style.display = 'none';
        },function(){
            checkbox.parentNode.children[1].style.display = 'none';
        });
    }
    else{
        request('/services/data/v32.0/tooling/query?q=' + encodeURI("Select Id From TraceFlag Where TracedEntityId = '" + classId + "'"))
            .then(function(response){
                var responseObj = JSON.parse(response);
                if(responseObj.records.length > 0){
                    var traceFlagId = responseObj.records[0].Id;
                    request('/services/data/v32.0/tooling/sobjects/TraceFlag/'+traceFlagId  ,'DELETE').then(function(){
                        checkbox.parentNode.children[1].style.display = 'none';
                    });
                }
            });
    }

}

function toArray(nodeList){
    return [].slice.call(nodeList);
}

function request(url,method,body,contentType){
    method = method || 'GET';
    if(typeof GM_xmlhttpRequest === "function"){
        return new Promise(function(fulfill,reject){
            GM_xmlhttpRequest({
                method:method,
                data: body,
                url:url,
                headers:{
                    Authorization:'Bearer ' + sid,
                    'Content-Type': contentType,
                    Accept:'*/*'
                },
                onload:function(response){
                    if( response.status.toString().indexOf('2') === 0){
                        fulfill(response.response);
                    }else{
                        reject(response.statusText);
                    }
                },
                onerror:function(response){
                    reject(Error("Network Error"));
                }
            });
        });
    }
    return new Promise(function(fulfill,reject){
        var xhr = new XMLHttpRequest();
        xhr.open(method,url);
        xhr.setBody(body);
        xhr.onload = function(){
            if( xhr.status.toString().indexOf('2') === 0){
                fulfill(xhr.response);
            }else{
                reject(xhr.statusText);
            }
        };
        xhr.onerror = function(){
            reject(Error("Network Error"));
        };
        xhr.setRequestHeader('Authorization','Bearer ' + sid);
        xhr.setRequestHeader('Content-Type',contentType);
        xhr.send();
    });
}
})();
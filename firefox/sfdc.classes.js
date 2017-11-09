(function(){

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

addHeader();
addCheckboxes();
addButton();

function addButton(){
    var classesRowsPerPageParameter = 'all_classes_page:theTemplate:classList:rowsperpage',
        triggersRowsPerPageParameter = 'all_triggers_page:theTemplate:j_id41:rowsperpage';


    if(document.getElementById('all_classes_page:theTemplate:theForm')){
        var seeAllClasses = document.createElement('input');
        seeAllClasses.value = 'See All Classes';
        seeAllClasses.className = 'btn';
        seeAllClasses.type = 'button';
        seeAllClasses.onclick = function(){
            logEvent('seeAllClasses')
            if(location.search.indexOf('rowsperpage=') > -1){
                window.location.search = 'setupid=ApexClasses&' + encodeURIComponent(classesRowsPerPageParameter) + '=3500';
            }
            else{
                window.location.search += '&' + encodeURIComponent(classesRowsPerPageParameter) + '=3500';
            }
        };
        document.getElementById('all_classes_page:theTemplate:theForm').querySelector('td').appendChild(seeAllClasses);
    }
    if(document.querySelector('input[value="Developer Console"]')){
        var seeAllTriggers = document.createElement('input');
        seeAllTriggers.value = 'See All Trigger';
        seeAllTriggers.className = 'btn';
        seeAllTriggers.type = 'button';
        seeAllTriggers.onclick = function(){
            logEvent('seeAllTriggers')
            if(location.search.indexOf('rowsperpage=') > -1){
                window.location.search = 'setupid=ApexClasses&' + encodeURIComponent(triggersRowsPerPageParameter) + '=3500';
            }
            else{
                window.location.search += '&' + encodeURIComponent(triggersRowsPerPageParameter) + '=3500';
            }
        };
        document.querySelector('input[value="Developer Console"]').parentNode.appendChild(seeAllTriggers);
    }
}


function addHeader(){
    var header = document.createElement('th');
    header.textContent = 'Dont Log Class';
    var selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.onclick = function(event){
        logEvent('selectAll')
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
    var classId = classLink.slice(classLink.lastIndexOf('/01')+1);
    var isChecked = row.querySelector('td>img').title === "Checked";
    clone.firstChild.dataset.classId = classId;
    clone.firstChild.onclick = toggleTraceFlag;
    clone.firstChild.checked = isChecked;
    row.appendChild(clone);
}

function toggleTraceFlag(event){
    logEvent('toggleTraceFlag')
    var noLog = {Workflow: 'NONE',Validation: 'NONE',Callout: 'NONE',ApexCode: 'NONE',ApexProfiling: 'NONE',Visualforce: 'NONE',System: 'NONE',Database: 'NONE'};
    var checkbox = this;
    var classId = checkbox.dataset.classId;
    var dontLog = checkbox.checked;
    checkbox.parentNode.children[1].style.display = 'inline';
    noLog.TracedEntityId = classId;
    if(dontLog){
        request('/services/data/v32.0/tooling/sobjects/TraceFlag/','POST',JSON.stringify(noLog),'application/json').then(function(result){
            console.log(result);
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

function logEvent(eventName){
  if(typeof browser !== "undefined"){
    let eventParams = ['_trackEvent', 'Classes', eventName]
    browser.runtime.sendMessage({command: "ga", params: eventParams});
  }
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
        //xhr.setBody(body);
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
        xhr.send(body);
    });
}
})();

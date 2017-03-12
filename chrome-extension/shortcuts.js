//
//                       _oo0oo_
//                      o8888888o
//                      88" . "88
//                      (| -_- |)
//                      0\  =  /0
//                    ___/`---'\___
//                  .' \\|     |// '.
//                 / \\|||  :  |||// \
//                / _||||| -:- |||||- \
//               |   | \\\  -  /// |   |
//               | \_|  ''\---/''  |_/ |
//               \  .-\__  '-'  ___/-. /
//             ___'. .'  /--.--\  `. .'___
//          ."" '<  `.___\_<|>_/___.' >' "".
//         | | :  `- \`.;`\ _ /`;.`/ - ` : | |
//         \  \ `_.   \_ __\ /__ _/   .-` /  /
//     =====`-.____`.___ \_____/___.-`___.-'=====
//                       `=---='
//

(function(){
var sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/);
var sid = sidCookie ? sidCookie[2] : false;


function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function sendBackUserId(){
    if(window.UserContext){
        window.postMessage({type: "userId", content: UserContext.userId}, "*");
    }
}

function sendBackOrgId(){
    if(document.cookie.indexOf('oid=') > -1){
        window.postMessage({type: "orgId", content: document.cookie.substr(document.cookie.indexOf('oid=') + 4, 15)}, "*");
    }
}

window.addEventListener("message", function(event) {
    var userId, orgId;
    if(event.data.type === "userId"){
        userId = event.data.content;
        shortcutUrl('d', "/setup/ui/listApexTraces.apexp");
    }
    if(event.data.type === "orgId"){
        orgId = event.data.content;
        shortcutUrl('i', '/' + orgId);
    }
});

inject(sendBackUserId);
inject(sendBackOrgId);

shortcutUrl('s', "/_ui/platform/schema/ui/schemabuilder/SchemaBuilderUi?setupid=SchemaBuilder");
shortcutUrl('o', "/p/setup/custent/CustomObjectsPage");
shortcutUrl('u', "/005?setupid=ManageUsers");
shortcutUrl('p', "/00e?setupid=EnhancedProfiles");
shortcutUrl('c', "/01p?all_classes_page%3AtheTemplate%3AclassList%3Arowsperpage=3500");
shortcutUrl('a', "/05G");
shortcutUrl('t', "/setup/build/allTriggers.apexp?all_triggers_page%3AtheTemplate%3Aj_id41%3Arowsperpage=3000");
shortcutUrl('q', "/changemgmt/listOutboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=OutboundChangeSet");
shortcutUrl('z', "/changemgmt/listInboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=InboundChangeSet");
shortcutMethod('l', openLastLog);
Mousetrap.bind('e', editObject);
Mousetrap.bind('s', saveObject);

function shortcutMethod(char, method){
    Mousetrap.bind(['alt+shift+' + char], function(){
        method();
    });
    Mousetrap.bind(['shift+' + char], function(){
        method(true);
    });
}


function shortcutUrl(char, url){
    logEvent('shortcutUrl')
    Mousetrap.bind(['alt+shift+' + char], function(){
        document.location.assign(url);
     });
    Mousetrap.bind(['shift+' + char], function(){
        if( document.activeElement.nodeName == "OBJECT" && 
            document.activeElement.data.indexOf('.swf') > -1){
          return;
        }
        openInNewTab(url);
    });
}

function openInNewTab(url){
    if(typeof GM_openInTab === 'function'){
        GM_openInTab(location.origin + url);
    }else if(typeof chrome !== "undefined"){
        chrome.runtime.sendMessage({url: `${location.protocol}//${location.host}${url}`, command: "openTab"});
    }else{
        window.open(url, '_blank');
    }
}

function editObject(){
    logEvent('editObject')
    var editBtn = document.querySelector("input[name='edit']");
    if(editBtn){
        editBtn.click();
    }
}

function saveObject(){
    logEvent('editObject')
    var saveBtn = document.querySelector("input[name='save']");
    if(saveBtn){
        saveBtn.click();
    }
}


function openLastLog(inNewTab){
    logEvent('openLastLog')
    if(!sid){
        return;
    }
    request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent('SELECT Id,LastModifiedDate,StartTime,Status,SystemModstamp FROM ApexLog ORDER BY LastModifiedDate DESC Limit 1')).then(function(result){
        var reponseObj = JSON.parse(result);
        if(reponseObj.records && reponseObj.records.length > 0){
            var url = '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' + reponseObj.records[0].Id;
            if(inNewTab){
                openInNewTab(url);
            }else{
                document.location.assign(url);
            }
        }
    });
}

function logEvent(eventName){
  if(typeof chrome !== "undefined"){
    let eventParams = ['_trackEvent', 'Shortcut', eventName]
    chrome.runtime.sendMessage({command: "ga", params: eventParams});
  }
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
                    rejected(Error("Network Error"));
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
            rejected(Error("Network Error"));
        };
        xhr.setRequestHeader('Authorization', 'Bearer ' + sid);
        xhr.send();
    });
}

})();

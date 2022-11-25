var sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/);
var sid = sidCookie ? sidCookie[2] : false;
var sessionVars;

function sendBackOrgId() {
    window.postMessage({
      type: "orgId",
      sessionVars: JSON.stringify(window.SFDCSessionVars)
    }, "*");
}

window.addEventListener("message", function(event) {
  if (event.data.type === "orgId" && event.data.sessionVars) {
    sessionVars = JSON.parse(event.data.sessionVars)
    browser.runtime.sendMessage({
      command: "updateVars",
      vars: sessionVars,
      sid: sid
    })
    shortcutUrl({
      key: 'i',
      path: '/' + sessionVars.oid
    });
  }
});

inject(sendBackOrgId);

browser.storage.sync.get('shortcuts')
  .then(function({
    shortcuts = default_shortcuts
  }) {
    shortcuts.filter(s => s.path).forEach(shortcutUrl)
    shortcuts.filter(s => s.app).forEach(shortcut => {
      shortcutMethod(shortcut.key, openApp)
    })
    Mousetrap.bind('shift+w', openApp);
  });

shortcutMethod('l', openLastLog);
Mousetrap.bind('e', editObject);
Mousetrap.bind('s', saveObject);
// shortcutUrl({key:'w', path:'/setup/ui/listApexTraces.apexp'});

function openApp(){
  if (document.activeElement.nodeName == "OBJECT" &&
    document.activeElement.data.indexOf('.swf') > -1) {
    return;
  }
  logEvent('Shortcut','openApp')
  browser.runtime.sendMessage({
      command: "focusAppTab"
  }).then((appOpened) => {
    if(!appOpened){
      if(document.location.hostname.includes(".salesforce.com")) {
        browser.runtime.sendMessage({
            url: `${browser.extension.getURL('html/app.html')}?oid=${sessionVars.oid}&uid=${sessionVars.uid}&sid=${encodeURIComponent(sid)}&host=${encodeURIComponent(location.hostname)}`,
            name: `app_${sessionVars.oid}`,
            command: "openOrFocusTab"
          });
      }else{
        openInNewTab('/setup/ui/listApexTraces.apexp?openApp=yes')
      }
    }
  });
}

function shortcutMethod(char, method) {
  Mousetrap.bind(['alt+shift+' + char], function() {
    method();
  });
  Mousetrap.bind(['shift+' + char], function() {
    method(true);
  });
}


function shortcutUrl({
  key,
  path
}) {
  Mousetrap.bind(['alt+shift+' + key], function() {
    if (key != 'i') logEvent('Shortcut', 'shortcutUrl', `alt+shift+${key} - ${path}`)
    document.location.assign(path);
  });
  Mousetrap.bind(['shift+' + key], function() {
    if (document.activeElement.nodeName == "OBJECT" &&
      document.activeElement.data.indexOf('.swf') > -1) {
      return;
    }
    if (key != 'i') logEvent('Shortcut', 'shortcutUrl', `${key} - ${path}`)
    openInNewTab(path);
  });
}

function openInNewTab(path) {
  browser.runtime.sendMessage({
      url: `${location.protocol}//${location.host}${path}`,
      command: "openTab"
    });
}


function editObject() {
  logEvent('Shortcut','editObject')
  var editBtn = document.querySelector("input[name='edit']");
  if (editBtn) {
    editBtn.click();
  }
}

function saveObject() {
  logEvent('Shortcut','saveObject')
  var saveBtn = document.querySelector("input[name='save']");
  if (saveBtn) {
    saveBtn.click();
  }
}


function openLastLog(inNewTab) {
  logEvent('Shortcut','openLastLog')
  if (!sid) {
    return;
  }
  sfRequest('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent('SELECT Id,LastModifiedDate,StartTime,Status,SystemModstamp FROM ApexLog ORDER BY LastModifiedDate DESC Limit 1'))
    .then(result => result.json()).then(responseObj => {
      if (responseObj.records && responseObj.records.length > 0) {
        var url = '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' + responseObj.records[0].Id;
        if (inNewTab) {
          openInNewTab(url);
        } else {
          document.location.assign(url);
        }
      }
    });
}

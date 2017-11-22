var sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/);
var sid = sidCookie ? sidCookie[2] : false;
var orgId;

function sendBackOrgId() {
  if (document.cookie.indexOf('oid=') > -1) {
    window.postMessage({
      type: "orgId",
      content: document.cookie.substr(document.cookie.indexOf('oid=') + 4, 15)
    }, "*");
  }
}

window.addEventListener("message", function(event) {
  if (event.data.type === "orgId") {
    orgId = event.data.content
    shortcutUrl({
      key: 'i',
      path: '/' + event.data.content
    });
  }
});

inject(sendBackOrgId);

browser.storage.sync.get('shortcuts')
  .then(function({
    shortcuts = default_shortcuts
  }) {
    shortcuts.forEach(shortcutUrl)
  });

shortcutMethod('l', openLastLog);
Mousetrap.bind('e', editObject);
Mousetrap.bind('s', saveObject);
Mousetrap.bind('shift+x', openApp);

function openApp(){
  browser.runtime.sendMessage({
      url: `${browser.extension.getURL('html/app.html')}?sid=${sid}&orgId=${orgId}&host=${encodeURIComponent(location.hostname)}`,
      name: `app_${orgId}`,
      command: "openOrFocusTab"
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

var sessionVars;
console.log('SFDCSessionVars', window.SFDCSessionVars)
// function sendBackOrgId() {
//     window.postMessage({
//       type: "orgId",
//       sessionVars: JSON.stringify(window.SFDCSessionVars)
//     }, "*");
// }

// window.addEventListener("message", function(event) {
//   if (event.data.type === "orgId" && event.data.sessionVars) {
//     sessionVars = JSON.parse(event.data.sessionVars)
//     browser.runtime.sendMessage({
//       command: "updateVars",
//       vars: sessionVars,
//       sid: sid
//     })
//     shortcutUrl({
//       key: 'i',
//       path: '/' + sessionVars.oid
//     });
//   }
// });

// inject(sendBackOrgId);

// browser.storage.sync.get('shortcuts')
  function setShortcuts({
    shortcuts = default_shortcuts
  }) {
    console.log(shortcuts)
    shortcuts.filter(s => s.path).forEach(shortcutUrl)
    shortcuts.filter(s => s.app).forEach(shortcut => {
      shortcutMethod(shortcut.key, openApp)
    })
    Mousetrap.bind('shift+w', openApp);
  }

  async function sendMessage(message) {
    try {
      console.log('MEssage:', message);
      const response = await chrome.runtime.sendMessage(message);
      console.log('Response:', response);
      return response;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }

async function  getShortcuts() {
    const response = await sendMessage({command: "getShortcuts"});
    setShortcuts({shortcuts: response.shortcuts})
}

getShortcuts();

shortcutMethod('l', openLastLog);
Mousetrap.bind('e', editObject);
Mousetrap.bind('s', saveObject);
// shortcutUrl({key:'w', path:'/setup/ui/listApexTraces.apexp'});

async function openApp(){
  if (document.activeElement.nodeName == "OBJECT" &&
    document.activeElement.data.indexOf('.swf') > -1) {
    return;
  }
  logEvent('Shortcut','openApp')
  const { orgId, userId } = parseDiscoCookie();
  const sid = await getToken();
  chrome.runtime.sendMessage({
      command: "focusAppTab"
  }).then((appOpened) => {
    if(!appOpened){
      if(document.location.hostname.includes(".salesforce")) {
        chrome.runtime.sendMessage({
            url: `${chrome.runtime.getURL('html/app.html')}?oid=${orgId}&uid=${userId}&sid=${encodeURIComponent(sid)}&host=${encodeURIComponent(location.hostname)}`,
            name: `app_${orgId}`,
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
  console.log('openInNewTab', path)
  window.open(path, '_blank');
  // browser.runtime.sendMessage({
  //     url: `${location.protocol}//${location.host}${path}`,
  //     command: "openTab"
  //   });
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

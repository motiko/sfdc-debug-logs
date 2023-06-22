const sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/)
var sid = sidCookie && sidCookie.length >= 3 ? sidCookie[2] : null;
browser.storage.local.get('token').then(function({
  token
}) {
    if(token){
      sid = sid || token;
    }
});

function inject(fn) {
  var script = document.createElement('script');
  script.setAttribute("type", "application/javascript");
  script.textContent = '(' + fn + ')();';
  document.body.appendChild(script); // run the script
  document.body.removeChild(script); // clean up
}

function sfRequest(path, method = 'GET', headers = {}, body) {
  if (!headers['X-SFDC-Session']) {
    headers['Authorization'] = 'Bearer ' + sid
  }
  return fetch(location.origin + path, {
      method,
      body,
      headers
    })
    .then(result => {
      if (result.ok) {
        return result
      } else {
        throw Error(`${result.status} : ${result.statusText}`)
      }
    })
}

function logEvent(eventCat, eventName, eventLabel){
}

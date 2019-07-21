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

const sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/)
let sid = sidCookie && sidCookie.length >= 3 ? sidCookie[2] : null;

async function getToken() {
  if(sid){
    return sid
  }
  const token = await chrome.runtime.sendMessage({
    command: "getToken"
  })
  console.log('getToken', token)
  return token
}
// chrome.storage.local.get('token').then(function({
//   token
// }) {
//     if(token){
//       sid = sid || token;
//     }
// });

function inject(fn) {
  // var script = document.createElement('script');
  // script.setAttribute("type", "application/javascript");
  // script.textContent = '(' + fn + ')();';
  // document.body.appendChild(script); // run the script
  // document.body.removeChild(script); // clean up
  console.log('Inject is deprecated')
}

async function sfRequest(path, method = 'GET', headers = {}, body) {
  const token = await getToken()
  console.log('token', token)
  if (headers['X-SFDC-Session']) {
    headers['X-SFDC-Session'] = token
  }else{
    headers['Authorization'] = 'Bearer ' + token
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

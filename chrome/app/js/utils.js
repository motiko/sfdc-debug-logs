const sidCookie = document.cookie.match(/(^|;\s*)sid=(.+?);/)
let sid = sidCookie && sidCookie.length >= 3 ? sidCookie[2] : null;

async function getToken() {
  if(sid){
    return sid
  }
  console.log('Apex Debugger: ','Session ID not found in cookie if httpOnly is enabled, you need to manually set it in the extension options')
  const result = await chrome.runtime.sendMessage({
    command: "getToken"
  })
  if(!result.token){
   console.log('Apex Debugger:', 'Token is not set in the extension options see here how to get it', 'https://www.decodeforce.com/blogs/get-session-id-in-apex')
   console.log('After getting it set it in the extension options (last field) and try again')
  }
  return result.token
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
        console.log('Apex Debugger:','Make sure Session ID is valid and not expired')
        throw Error(`${result.status} : ${result.statusText}`)
      }
    })
}

function logEvent(eventCat, eventName, eventLabel){
}

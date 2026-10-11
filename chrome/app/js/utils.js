// Salesforce REST API path for every content-script call. Keep in sync with
// react/src/api/version.js and scripts/lib/sf-auth.mjs.
const API_PATH = '/services/data/v62.0';
const ASYNC_API_PATH = '/services/async/62.0'; // Bulk API 1.0

// Returns a cookie's value, or null. Matches the last cookie too, which has
// no trailing ';'.
function readCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? match[1] : null;
}

// Returns { token, host }: the API session id and the host it belongs to.
// Salesforce's sid cookie is HttpOnly, so it usually can't be read here; the
// service worker reads it with chrome.cookies (falling back to the token saved
// on the options page).
async function getSession() {
  const sid = readCookie('sid');
  if (sid) {
    return { token: sid, host: location.hostname };
  }
  const session = await chrome.runtime.sendMessage({ command: "getToken" });
  if (!session || !session.token) {
    console.log('Apex Debugger:', 'no Salesforce session found. Log in again, or save a session id in the extension options.');
    return { token: undefined, host: location.hostname };
  }
  return { token: session.token, host: session.host || location.hostname };
}

async function getToken() {
  return (await getSession()).token;
}

function parseDiscoCookie() {
  const disco = readCookie('disco');
  if (!disco) {
    console.log('Apex Debugger:', 'disco cookie not found; cannot tell the org and user ids');
    return { orgId: undefined, userId: undefined };
  }
  const ids = disco.split(":");
  return { orgId: ids[1], userId: ids[2] };
}

function getUserId() {
  const { userId } = parseDiscoCookie();
  return userId;
}

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

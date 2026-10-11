export default function initRequest(host, sid, orgId) {
  let sessionId = sid
  let retries = 0
  const max_retries = 3
  // After a 401, ask the service worker for the current session cookie.
  function getSessionId() {
    return chrome.runtime
      .sendMessage({
        command: 'getToken',
        url: `https://${host}/`
      })
      .then(session => session && session.token)
  }
  return function call(
    path,
    method = 'GET',
    headers = {},
    body,
    response = 'json'
  ) {
    headers['Authorization'] = 'Bearer ' + sessionId
    if (response === 'json') {
      headers['Accept'] = 'application/json'
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json; charset=UTF-8'
      body = JSON.stringify(body)
    }
    return fetch(`https://${host}${path}`, { method, body, headers })
      .then(result => {
        console.log(result)
        if (result.ok) {
          retries = 0
          const contentType = result.headers.get('Content-Type')
          if (contentType && contentType.startsWith('application/json')) {
            return result.json()
          }
          return result
        } else if (result.status === 401 && retries <= max_retries) {
          return getSessionId().then(s => {
            retries++
            sessionId = s
            return call(path, method, headers, body, response)
          })
        } else {
          throw Error(`${result.status}: ${result.statusText}`)
        }
      })
      .catch(err => {
        if (err.message.substring(0, 3) === '401') {
          throw Error(`401: Unauthorized`)
        } else {
          throw err
        }
      })
  }
}

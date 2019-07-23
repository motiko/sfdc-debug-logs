export default function initRequest(host, sid, orgId) {
  let sessionId = sid
  let retries = 0
  const max_retries = 3
  getSessionId(orgId).then(s => (sessionId = s))
  function getSessionId(orgId) {
    return browser.runtime
      .sendMessage({
        command: 'getVars',
        orgId
      })
      .then(vars => vars.sid)
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
    return window
      .fetch(`https://${host}${path}`, { method, body, headers })
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
          return getSessionId(orgId).then(s => {
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

export default function initRequest(host, sid) {
  return function(path, method = 'GET', headers = {}, body, response = 'json') {
    headers['Authorization'] = 'Bearer ' + sid
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
        if (result.ok) {
          const contentType = result.headers.get('Content-Type')
          if (contentType && contentType.startsWith('application/json')) {
            return result.json()
          }
          return result
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

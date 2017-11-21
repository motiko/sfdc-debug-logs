var SF = {}

SF.host = ""
SF.sid = ""

SF.requestLogs = function requestLogs() {
  var selectQuery = [`SELECT LogUser.Name,Application,DurationMilliseconds,`,
    `Id,LastModifiedDate,Location,LogLength,LogUserId,`,
    `Operation,Request,StartTime,Status,SystemModstamp From `,
    `ApexLog Where LastModifiedDate > LAST_MONTH ORDER BY `,
    `LastModifiedDate ASC LIMIT 5`
  ].join('');
  return request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent(selectQuery))
    .then(r => r.json())
    .then(responseObj => responseObj.records)
    .catch(function(err) {
      console.error(err)
    });
}

function request(path, method = 'GET', headers = {}, body) {
  if (!headers['X-SFDC-Session']) {
    headers['Authorization'] = 'Bearer ' + SF.sid
  }
  return fetch(`https://${SF.host}${path}`, {
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

export default SF

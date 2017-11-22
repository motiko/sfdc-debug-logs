var SF = {}

SF.host = ""
SF.sid = ""

SF.logBody = function logBody(logId){
  return request(`/services/data/v32.0/tooling/sobjects/ApexLog/${logId}/Body`)
    .then(r => r.text())
    .catch(function(err) {
      console.error(err);
    })
}

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
    }).catch((err)=>{
      if(err.message.substring(0,3) === "401"){
          // TODO give proper message of expired session
      }
    })
}

export default SF

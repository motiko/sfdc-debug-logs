var SF = {}

SF.host = ""
SF.sid = ""

SF.logBody = function logBody(logId){
  return request(`/services/data/v32.0/tooling/sobjects/ApexLog/${logId}/Body`)
    .then(r => r.text())
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
        throw Error(`${result.status}: ${result.statusText}`)
      }
    }).catch((err)=>{
      if(err.message.substring(0,3) === "401"){
          // TODO give proper message of expired session
          throw Error(`401: Unauthorized`)
      }
    })
}

function createJob(objectName, operation) {
  var queryJob = `<?xml version="1.0" encoding="UTF-8"?>
   <jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
        <operation>${operation}</operation>
        <object>${objectName}</object>
        <concurrencyMode>Parallel</concurrencyMode>
        <contentType>CSV</contentType>
   </jobInfo>`;
  return sfRequest('/services/async/34.0/job', 'POST', {
        'Content-Type': 'application/xml',
        'X-SFDC-Session': sid
      },
      queryJob).then(r => r.text())
    .then(function(response) {
      return response.match(/<id>(.*)<\/id>/)[1];
    });
}

function pollBatchStatus(jobId, batchId) {
  return new Promise(function(resolve, reject) {
    var intervalId = setInterval(function() {
      checkBatchStatus(jobId, batchId).then(function(state) {
        if (state === "Completed") {
          resolve(state);
          clearInterval(intervalId);
        }
        if (state === "Error" || state === "Not Processed") {
          reject(state);
          clearInterval(intervalId);
        }

      });

    }, 1000);
  });
}

function checkBatchStatus(jobId, batchId) {
  return sfRequest(`/services/async/34.0/job/${jobId}/batch/${batchId}`, 'GET', {
      'X-SFDC-Session': sid
    })
    .then(r => r.text())
    .then(function(resultXml) {
      return resultXml.match(/<state>(.*)<\/state>/)[1];
    });
}

function createBatch(jobId, csv) {
  return sfRequest(`/services/async/34.0/job/${jobId}/batch`, 'POST', {
        'Content-Type': 'text/csv; charset=UTF-8',
        'X-SFDC-Session': sid
      },
      csv).then(r => r.text())
    .then(function(response) {
      return response.match(/<id>(.*)<\/id>/)[1];
    });
}

export default SF

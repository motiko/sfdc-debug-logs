import regeneratorRuntime from "regenerator-runtime";

var SF = {}

SF.host = ""
SF.sid = ""

SF.logBody = function logBody(logId) {
  return request(`/services/data/v32.0/tooling/sobjects/ApexLog/${logId}/Body`)
    .then(r => r.text())
}

SF.requestLogs = function requestLogs(numLimit=50,timeLimit="LAST_MONTH") {
  var selectQuery = [`SELECT LogUser.Name,Application,DurationMilliseconds,`,
    `Id,LastModifiedDate,Location,LogLength,LogUserId,`,
    `Operation,Request,StartTime,Status,SystemModstamp From `,
    `ApexLog Where LastModifiedDate > ${timeLimit} ORDER BY `,
    `LastModifiedDate ASC LIMIT ${numLimit}`
  ].join('');
  return request('/services/data/v32.0/tooling/query/?q=' + encodeURIComponent(selectQuery))
    .then(r => r.json())
    .then(responseObj => responseObj.records)
}

SF.deleteAll = async function deleteAll(ids) {
  let logIdsCsv = ids.reduce((acc, id) => `${acc}\n"${id}"`, `"Id"`)
  let job = await createJob('ApexLog', 'delete')
  await attachBatchToJob(job,logIdsCsv)
  await closeJob(job.id)
  return pollJobStatus(job.id)
}

function attachBatchToJob(job,csv){
  return request(`/${job.contentUrl}`, 'PUT', {
      'Content-Type': 'text/csv'
    }, csv)
}

function request(path, method = 'GET', headers = {}, body) {
  headers['Authorization'] = 'Bearer ' + SF.sid
  headers['Accept'] = 'application/json'
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json; charset=UTF-8'
    body = JSON.stringify(body)
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
    }).catch((err) => {
      if (err.message.substring(0, 3) === "401") {
        throw Error(`401: Unauthorized`)
      }
    })
}

function createJob(objectName, operation) {
  var job = {
    object: objectName,
    operation: operation
  }
  return request('/services/data/v41.0/jobs/ingest', 'POST', {}, job)
    .then(r => r.json())
}

function closeJob(jobId) {
  return request(`/services/data/v41.0/jobs/ingest/${jobId}`,
    'PATCH', {}, {
      state: "UploadComplete"
    })
}

function checkJobStatus(jobId) {
  return request(`/services/data/v41.0/jobs/ingest/${jobId}`)
    .then(r => r.json())
}

function pollJobStatus(jobId) {
  return new Promise(function(resolve, reject) {
    var intervalId = setInterval(function() {
      checkJobStatus(jobId).then(function({
        state
      }) {
        if (state === "JobComplete") {
          clearInterval(intervalId);
          resolve(state);
        }
        if (state === "Failed" || state === "Not Processed") {
          clearInterval(intervalId);
          reject(state);
        }
      });
    }, 1000);
  });
}

export default SF

import regeneratorRuntime from "regenerator-runtime";

var SF = {}

SF.host = ""
SF.sid = ""
SF.userId = ""

const LOG_LEVEL_NAME = "ApexDebugger"

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
    .then(responseObj => responseObj.records)
}

SF.deleteAll = async function deleteAll(ids) {
  let logIdsCsv = ids.reduce((acc, id) => `${acc}\n"${id}"`, `"Id"`)
  let job = await createJob('ApexLog', 'delete')
  await attachBatchToJob(job,logIdsCsv)
  await closeJob(job.id)
  return pollJobStatus(job.id)
}

SF.isLogging = async function isLogging(){
  const userId = await getUserId()
  const query = encodeURIComponent(`Select Id From TraceFlag Where TracedEntityId = '${userId}'`)
  return request(`/services/data/v36.0/tooling/query?q=${query}`)
    .then(result => result.records.length > 0)
}

SF.startLogging = async function startLogging() {
  const userId = await getUserId()
  const dlId = await getOrCreateDebugLevel()
  var payload = {
    TracedEntityId: userId,
    DebugLevelId: dlId,
    LogType: 'DEVELOPER_LOG'
  };
  return request('/services/data/v36.0/tooling/sobjects/TraceFlag/', 'POST',
    {}, payload)
}

const getUserId = function (){
  return request('/services/data/v24.0/chatter/users/me')
    .then((me) =>  me.id)
}

function getOrCreateDebugLevel(){
  const headers = {
    "Accept": "*/*"
  }
  const query = encodeURIComponent("Select Id From DebugLevel Where DeveloperName = '" + LOG_LEVEL_NAME + "'")
  var debugLevelPayload = {
    DeveloperName: LOG_LEVEL_NAME,
    MasterLabel: LOG_LEVEL_NAME,
    Workflow: 'DEBUG',
    Validation: 'DEBUG',
    Callout: 'DEBUG',
    ApexCode: 'DEBUG',
    ApexProfiling: 'DEBUG',
    Visualforce: 'DEBUG',
    System: 'DEBUG',
    Database: 'DEBUG'
  }
  return request(`/services/data/v36.0/tooling/query?q=${query}`,'GET',headers)
    .then(existingDebugLevel => {
      if (existingDebugLevel.records.length > 0) {
        return existingDebugLevel.records[0].Id
      } else {
        return request('/services/data/v36.0/tooling/sobjects/DebugLevel',
          'POST',headers,debugLevelPayload)
            .then(result => result.id)
      }
    })
}

function attachBatchToJob(job,csv){
  return request(`/${job.contentUrl}`, 'PUT', {
      'Content-Type': 'text/csv'
    }, csv)
}

function toolingQuery(query){
  return request()
}

function request(path, method = 'GET', headers = {}, body, response='json') {
  headers['Authorization'] = 'Bearer ' + SF.sid
  if(response == 'json') headers['Accept'] = 'application/json'
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
        if(response == 'json') return result.json()
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
}

function closeJob(jobId) {
  return request(`/services/data/v41.0/jobs/ingest/${jobId}`,
    'PATCH', {}, {
      state: "UploadComplete"
    })
}

function checkJobStatus(jobId) {
  return request(`/services/data/v41.0/jobs/ingest/${jobId}`)
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

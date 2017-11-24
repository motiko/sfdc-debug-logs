export default class Tooling {
  constructor(request) {
    this.request = request
  }

  getOrCreateDebugLevel() {
    const LOG_LEVEL_NAME = "ApexDebugger"
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
    return this.request(`/services/data/v36.0/tooling/query?q=${query}`, 'GET', headers).then(existingDebugLevel => {
      if (existingDebugLevel.records.length > 0) {
        return existingDebugLevel.records[0].Id
      } else {
        return request('/services/data/v36.0/tooling/sobjects/DebugLevel', 'POST', headers, debugLevelPayload).then(result => result.id)
      }
    })
  }

  createTraceFlag(userId, debugLevelId) {
    const MS_IN_DAY = 1000 * 60 * 60 * 24
    let expirationDate = new Date(Date.now() + MS_IN_DAY - 100000)
    var payload = {
      TracedEntityId: userId,
      DebugLevelId: debugLevelId,
      LogType: 'DEVELOPER_LOG',
      ExpirationDate: expirationDate
    }
    return this.request('/services/data/v41.0/tooling/sobjects/TraceFlag', 'POST', {}, payload)
  }

  getLogBody(logId) {
    return this.request(`/services/data/v32.0/tooling/sobjects/ApexLog/${logId}/Body`, 'GET', {}, undefined, 'text').then(r => r.text())
  }

  query(query) {
    return this.request(`/services/data/v36.0/tooling/query?q=${query}`)
  }
}

import { API } from './version'

export default class Tooling {
  constructor(request) {
    this.request = request
  }

  getOrCreateDebugLevel() {
    const LOG_LEVEL_NAME = 'ApexDbgrExtension'
    const headers = {
      Accept: '*/*'
    }
    const query = encodeURIComponent(
      "Select Id From DebugLevel Where DeveloperName = '" + LOG_LEVEL_NAME + "'"
    )
    const debugLevelPayload = {
      DeveloperName: LOG_LEVEL_NAME,
      MasterLabel: LOG_LEVEL_NAME,
      Language: 'en_US',
      Workflow: 'DEBUG',
      Validation: 'DEBUG',
      Callout: 'DEBUG',
      ApexCode: 'DEBUG',
      ApexProfiling: 'DEBUG',
      Visualforce: 'DEBUG',
      System: 'DEBUG',
      Database: 'DEBUG'
    }
    return this.request(`${API}/tooling/query?q=${query}`, 'GET', headers).then(
      existingDebugLevel => {
        if (existingDebugLevel.records.length > 0) {
          return existingDebugLevel.records[0].Id
        } else {
          return this.request(
            `${API}/tooling/sobjects/DebugLevel`,
            'POST',
            {},
            debugLevelPayload
          ).then(result => result.id)
        }
      }
    )
  }

  async removeTraceFlags(userId, debugLevelId) {
    const query = `Select Id From TraceFlag Where TracedEntityId = '${userId}' AND DebugLevelId= '${debugLevelId}'`
    const existingTraceFlags = await this.query(query)
    return Promise.all(
      existingTraceFlags.records.map(traceFlag =>
        this.request(
          `${API}/tooling/sobjects/TraceFlag/${traceFlag.Id}`,
          'DELETE'
        )
      )
    )
  }

  // Traces the user for 24 hours. If that fails (e.g. an overlapping trace
  // flag exists), removes the user's flags for this debug level and retries
  // without an expiration date; Salesforce then applies its default.
  createTraceFlag(userId, debugLevelId) {
    const MS_IN_DAY = 1000 * 60 * 60 * 24
    const expirationDate = new Date(Date.now() + MS_IN_DAY)
    const payload = {
      TracedEntityId: userId,
      DebugLevelId: debugLevelId,
      LogType: 'DEVELOPER_LOG'
    }
    return this.request(
      `${API}/tooling/sobjects/TraceFlag`,
      'POST',
      {},
      { ...payload, ExpirationDate: expirationDate }
    ).catch(async err => {
      await this.removeTraceFlags(userId, debugLevelId)
      return this.request(
        `${API}/tooling/sobjects/TraceFlag`,
        'POST',
        {},
        {
          ...payload,
          StartDate: new Date()
        }
      )
    })
  }

  getLogBody(logId) {
    return this.request(
      `${API}/tooling/sobjects/ApexLog/${logId}/Body`,
      'GET',
      {},
      undefined,
      'text'
    ).then(r => r.text())
  }

  query(query) {
    return this.request(`${API}/tooling/query?q=${encodeURIComponent(query)}`)
  }
}

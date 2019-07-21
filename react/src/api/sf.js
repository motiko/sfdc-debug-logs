import regeneratorRuntime from 'regenerator-runtime' // eslint-disable-line
import initRequest from './request'
import Tooling from './tooling'
import Batch from './batch'

export default class SF {
  constructor(host, sid, userId, orgId) {
    this.hostname = host
    this.userId = userId
    this.orgId = orgId
    this.sid = sid
    this.request = initRequest(host, sid, orgId)
    this.batch = new Batch(this.request)
    this.tooling = new Tooling(this.request)
  }

  logBody(logId) {
    return this.tooling.getLogBody(logId)
  }

  requestLogs(numLimit = 50, whereClause = '') {
    var query = `SELECT LogUser.Name,Application,DurationMilliseconds,Id,\
LastModifiedDate,Location,LogLength,LogUserId,Operation,Request,StartTime,\
Status,SystemModstamp From ApexLog ${whereClause} \
ORDER BY LastModifiedDate DESC LIMIT ${numLimit}`
    return this.tooling.query(query).then(responseObj => responseObj.records)
  }

  async deleteAll() {
    let logs = await this.tooling.query('Select Id From ApexLog')
    let logIds = logs.records.map(r => r.Id)
    let logIdsCsv = logIds.reduce((acc, id) => `${acc}\n"${id}"`, `"Id"`)
    let job = await this.batch.createJob('ApexLog', 'delete')
    await this.batch.attachBatchToJob(job, logIdsCsv)
    await this.batch.closeJob(job.id)
    return this.batch.pollJobStatus(job.id)
  }

  async isLogging() {
    const query = `Select Id, ExpirationDate From TraceFlag Where TracedEntityId = '${
      this.userId
    }' AND ExpirationDate > ${new Date().toJSON()}`
    return this.tooling.query(query).then(result => result.records.length > 0)
  }

  async startLogging() {
    const debugLevelId = await this.tooling.getOrCreateDebugLevel()
    return this.tooling.createTraceFlag(this.userId, debugLevelId)
  }

  // getIdentity() {
  //   const request = initRequest('login.salesforce.com', this.sid)
  //   request(`/id/${this.orgId}/${this.userId}`).then(resp => {
  //   })
  // }
}

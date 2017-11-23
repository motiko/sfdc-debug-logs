import regeneratorRuntime from "regenerator-runtime";
import initRequest from './request'
import Tooling from './tooling'
import Batch from './batch'

export default class SF{
  constructor(host, sid){
    this.request = initRequest(host, sid)
    this.batch = new Batch(this.request)
    this.tooling = new Tooling(this.request)
  }

  logBody(logId) {
    return this.tooling.getLogBody(logId)
  }

  requestLogs(numLimit=50,timeLimit="LAST_MONTH") {
    var query = [`SELECT LogUser.Name,Application,DurationMilliseconds,`,
      `Id,LastModifiedDate,Location,LogLength,LogUserId,`,
      `Operation,Request,StartTime,Status,SystemModstamp From `,
      `ApexLog Where LastModifiedDate > ${timeLimit} ORDER BY `,
      `LastModifiedDate ASC LIMIT ${numLimit}`
    ].join('');
    return this.tooling.query(query)
            .then(responseObj => responseObj.records)
  }

  async deleteAll() {
    let logs = await this.tooling.query('Select Id From ApexLog')
    let logIds = logs.records.map(r => r.Id)
    let logIdsCsv = logIds.reduce((acc, id) => `${acc}\n"${id}"`, `"Id"`)
    let job = await this.batch.createJob('ApexLog', 'delete')
    await this.batch.attachBatchToJob(job,logIdsCsv)
    await this.batch.closeJob(job.id)
    return this.batch.pollJobStatus(job.id)
  }

  async isLogging(){
    const userId = await this.getUserId()
    const query = `Select Id From TraceFlag Where TracedEntityId = '${userId}'`
    return this.tooling.query(query).then(result => result.records.length > 0)
  }

  async startLogging() {
    const userId = await this.getUserId()
    const debugLevelId = await this.tooling.getOrCreateDebugLevel()
    return this.tooling.createTraceFlag(userId, debugLevelId)
  }

  getUserId() {
    return this.request('/services/data/v24.0/chatter/users/me')
      .then((me) =>  me.id)
  }

}

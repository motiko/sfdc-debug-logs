export default class Tooling{
  constructor(request){
    this.request = request
  }

  createTraceFlag(userId, debugLevelId){
    var payload = {
      TracedEntityId: userId,
      DebugLevelId: debugLevelId,
      LogType: 'DEVELOPER_LOG'
    };
    return this.request('/services/data/v36.0/tooling/sobjects/TraceFlag/', 'POST',
      {}, payload)
  }

  getLogBody(logId){
    return this.request(`/services/data/v32.0/tooling/sobjects/ApexLog/${logId}/Body`,'GET',{},undefined,'text')
      .then(r => r.text())
  }


  query(query){
    return this.request(`/services/data/v36.0/tooling/query?q=${query}`)
  }
}

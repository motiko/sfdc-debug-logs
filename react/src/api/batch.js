export default class Batch{
  constructor(request){
    this.request = request
  }

  createJob(objectName, operation) {
    var job = {
      object: objectName,
      operation: operation
    }
    return this.request('/services/data/v41.0/jobs/ingest', 'POST', {}, job)
  }

  closeJob(jobId) {
    return this.request(`/services/data/v41.0/jobs/ingest/${jobId}`,
      'PATCH', {}, {
        state: "UploadComplete"
      })
  }

  checkJobStatus(jobId) {
    return this.request(`/services/data/v41.0/jobs/ingest/${jobId}`)
  }

  pollJobStatus(jobId) {
    var that = this
    return new Promise(function(resolve, reject) {
      var intervalId = setInterval(() => {
        that.checkJobStatus(jobId).then(function({
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

  attachBatchToJob(job,csv){
    return this.request(`/${job.contentUrl}`, 'PUT', {
        'Content-Type': 'text/csv'
      }, csv)
  }
}

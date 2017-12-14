export function loadLogs(sf) {
  return dispatch => {
    dispatch({type: 'FETCH_LOGS_INIT'})
    sf.requestLogs().then((records) => {
      dispatch({type: 'FETCH_LOGS_RESPONSE', logs: records, })
    }).catch((err) => {
      dispatch({type: 'FETCH_LOGS_ERROR', message: `Error occured: ${err.message}`})
    })
  }
}

export function setMessage(message){
  return {type:'MESSAGE', message}
}

export function deleteAll(sf){
  return dispatch => {
    dispatch({type: 'DELETE_LOGS_INIT'})
    debugger
    sf.deleteAll().then(() => {
      dispatch({type: 'DELETE_LOGS_DONE'})
    })
  }
}

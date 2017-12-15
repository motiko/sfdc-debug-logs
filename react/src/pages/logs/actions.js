export function loadLogs() {
  return(dispatch, getState, sf) => {
    dispatch({type: 'FETCH_LOGS_INIT'})
    sf.requestLogs().then((records) => {
      dispatch({type: 'FETCH_LOGS_DONE', logs: records})
    }).catch((err) => {
      dispatch({type: 'FETCH_LOGS_ERROR', message: `Error occured: ${err.message}`})
    })
  }
}

export function setMessage(message) {
  return {type: 'MESSAGE', message}
}

export function deleteAll() {
  return(dispatch, getState, sf) => {
    dispatch({type: 'DELETE_LOGS_INIT'})
    debugger
    sf.deleteAll().then(() => {
      dispatch({type: 'DELETE_LOGS_DONE'})
    })
  }
}

export function search(searchTerm) {
  return(dispatch, getState, sf) => {
    dispatch({type: 'SEARCH_INIT'})
    debugger
    const {logs} = getState()
    const escapeRegExp = (str) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const searchRegex = new RegExp(escapeRegExp(searchTerm), 'gi');
    const logBodyPromises = logs.map(x => x.Id).map(x => ({id: x, promise: sf.logBody(x)}))
    const resultPromise = logBodyPromises.map((lbp) => lbp.promise.then((logBody) => ({id: lbp.id, found: searchRegex.test(logBody), body: logBody})))
    Promise.all(resultPromise).then((results) => {
      const foundIds = results.filter(r => r.found).map(r => r.id)
      dispatch({
        type: 'SEARCH_DONE',
        logs: logs.map(l => {
          l['not_matches_search'] = foundIds.indexOf(l.Id) == -1
          l['Body'] = results.find(r => r.id == l.Id)['Body']
          return l
        }),
        num: foundIds.length
      })
    })
  }
}

export function checkIsLogging() {
  return(dispatch, getState, sf) => {
    return sf.isLogging().then((isLogging) => dispatch({type: 'SET_LOGGING', isLogging}))
  }
}

export function startLogging() {
  return(dispatch, getState, sf) => {
    sf.startLogging().then((res) => {
      if (res && res.success)
        dispatch({type: 'SET_LOGGING', isLogging: true})
      else
        dispatch(checkIsLogging())
    })
  }
}

export function checkIsLoggingAndStart() {
  return(dispatch) => {
    dispatch(checkIsLogging()).then((res) => {
      if(!res.isLogging) dispatch(startLogging())
    })
  }
}

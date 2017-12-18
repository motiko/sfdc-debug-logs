import regeneratorRuntime from 'regenerator-runtime' // eslint-disable-line
import beautifyLog from './log-transform'

const normalize = (logsArray) => {
  return logsArray.reduce((acc, cur) => {
    return {...acc, [cur.Id]: cur}
  }, {})
}

export function toggleSideLogs () {
  return {type: 'TOGGLE_SIDE_LOGS'}
}

export function fetchLogBody (logId) {
  return async (dispatch, getState, sf) => {
    const logs = getState().logs.logs
    const ourLog = logs[logId]
    if (!ourLog) {
      const loadLogsRes = await dispatch(loadLogs())
      if (loadLogsRes.type === 'FETCH_LOGS_ERROR') { return }
      return dispatch(fetchLogBody(logId))
    }
    if (ourLog.body) {
      return
    }
    dispatch({type: 'FETCH_LOG_BODY_INIT'})
    return sf.logBody(logId).then((body) => {
      const beautifiedBody = beautifyLog(body)
      const updatedLogs = {...logs, [logId]: {...ourLog, body: beautifiedBody}}
      dispatch({type: 'FETCH_LOG_BODY_DONE', logs: updatedLogs})
    })
  }
}

export function loadLogs () {
  return (dispatch, getState, sf) => {
    const oldLogs = getState().logs.logs
    dispatch({type: 'FETCH_LOGS_INIT'})
    return sf.requestLogs().then((records) => {
      return dispatch({type: 'FETCH_LOGS_DONE', logs: {...normalize(records), ...oldLogs}})
    }).catch((err) => {
      return dispatch({type: 'FETCH_LOGS_ERROR', message: `Error occured: ${err.message}`})
    })
  }
}

export function setMessage (message) {
  return {type: 'MESSAGE', message}
}

export function deleteAll () {
  return (dispatch, getState, sf) => {
    dispatch({type: 'DELETE_LOGS_INIT'})
    sf.deleteAll().then(() => {
      dispatch({type: 'DELETE_LOGS_DONE'})
    })
  }
}

export function search (searchTerm) {
  return async (dispatch, getState, sf) => {
    dispatch({type: 'SEARCH_INIT'})
    const logs = getState().logs.logs
    const escapeRegExp = (str) => str.replace(/[-[]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
    const searchRegex = new RegExp(escapeRegExp(searchTerm), 'gi')
    const logsWithoutBodies = Object.values(logs).filter(l => !l.body)
    const promises = logsWithoutBodies.map(l => sf.logBody(l.Id)
        .then(body => ({ Id: l.Id, ...l, body })))
    const missingBodies = await Promise.all(promises)
    const filledLogs = { ...logs, ...normalize(missingBodies) }
    const newLogs = Object.values(filledLogs).reduce((acc, cur) => ({
      ...acc,
      [cur.Id]: {
        ...cur,
        not_matches_search: !searchRegex.test(cur.body)
      }
    }), {})
    const foundIds = Object.values(filledLogs).filter(r => r.not_matches_search)
    dispatch({
      type: 'SEARCH_DONE',
      logs: newLogs,
      num: foundIds.length
    })
  }
}

export function checkIsLogging () {
  return (dispatch, getState, sf) => {
    return sf.isLogging().then((isLogging) => dispatch({type: 'SET_LOGGING', isLogging}))
  }
}

export function startLogging () {
  return (dispatch, getState, sf) => {
    sf.startLogging().then((res) => {
      if (res && res.success) { dispatch({type: 'SET_LOGGING', isLogging: true}) } else { dispatch(checkIsLogging()) }
    })
  }
}

export function checkIsLoggingAndStart () {
  return (dispatch) => {
    dispatch(checkIsLogging()).then((res) => {
      if (!res.isLogging) dispatch(startLogging())
    })
  }
}

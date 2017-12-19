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
    let logs = getState().logs.logs
    let ourLog = logs[logId]
    if (!ourLog) {
      const loadLogsRes = await dispatch(loadLogs())
      if (loadLogsRes.type === 'FETCH_LOGS_ERROR') { return }
      if (loadLogsRes.logs[logId]) {
        logs = loadLogsRes.logs
        ourLog = loadLogsRes.logs[logId]
      } else {
        return dispatch({ type: 'FETCH_LOGS_ERROR', message: `Log with id ${logId} wasn't found` })
      }
    }
    if (ourLog.body) {
      return
    }
    dispatch({type: 'FETCH_LOG_BODY_INIT'})
    return sf.logBody(logId).then((body) => {
      const beautifiedBody = beautifyLog(body)
      const updatedLogs = {...logs, [logId]: {...ourLog, body: beautifiedBody}}
      dispatch({ type: 'FETCH_LOG_BODY_DONE', logs: updatedLogs })
    })
  }
}

export function loadLogs () {
  return (dispatch, getState, sf) => {
    dispatch({type: 'FETCH_LOGS_INIT'})
    dispatch({type: 'RESET_SEARCH'})
    let maxLogs = getState().logs.maxLogs
    if (!maxLogs || maxLogs < 1) {
      dispatch({type: 'UPDATE_MAX_LOGS', maxLogs: 1})
      maxLogs = 1
    }
    return sf.requestLogs(maxLogs).then((records) => {
      const oldLogs = getState().logs.logs
      const newLogs = {...normalize(records), ...oldLogs} // preserving fetched bodies TODO: hold in different object
      const limitedLogs = normalize(Object.values(newLogs).slice(0, maxLogs))
      return dispatch({type: 'FETCH_LOGS_DONE', logs: limitedLogs})
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
    const foundIds = Object.values(newLogs).filter(r => !r.not_matches_search)
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

export function updateSearchTerm (newTerm) {
  return {type: 'UPDATE_SEARCH_TERM', searchTerm: newTerm}
}

export function updateMaxLogs (maxLogs) {
  return {type: 'UPDATE_MAX_LOGS', maxLogs}
}

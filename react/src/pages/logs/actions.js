import regeneratorRuntime from "regenerator-runtime" // eslint-disable-line
import idbKeyval from "idb-keyval"

const normalize = logsArray => {
  return logsArray.reduce((acc, cur) => {
    return { ...acc, [cur.Id]: cur }
  }, {})
}

export function toggleSideLogs() {
  return { type: "TOGGLE_SIDE_LOGS" }
}

export function fetchLogBody(logId) {
  return async (dispatch, getState, sf) => {
    const logBodies = getState().logs.logBodies
    if (logBodies[logId]) {
      return
    }
    dispatch({ type: "FETCH_LOG_BODY_INIT" })
    const body = await idbKeyval.get(logId)
    if (body) {
      return dispatch({ type: "FETCH_LOG_BODY_DONE", logId, logBody: body })
    }
    return sf
      .logBody(logId)
      .then(body => {
        dispatch({ type: "FETCH_LOG_BODY_DONE", logId, logBody: body })
        idbKeyval.set(logId, body)
      })
      .catch(err => {
        return dispatch({
          type: "FETCH_LOGS_ERROR",
          message: `Error occured: ${err.message}`
        })
      })
  }
}

export function loadLogs() {
  return (dispatch, getState, sf) => {
    dispatch({ type: "FETCH_LOGS_INIT" })
    dispatch({ type: "RESET_SEARCH" })
    let maxLogs = getState().logs.maxLogs
    if (!maxLogs || maxLogs < 1) {
      dispatch({ type: "UPDATE_MAX_LOGS", maxLogs: 1 })
      maxLogs = 1
    }
    return sf
      .requestLogs(maxLogs)
      .then(records => {
        const oldLogs = getState().logs.logs
        const newLogs = { ...normalize(records), ...oldLogs } // preserving fetched bodies TODO: hold in different object
        const limitedLogs = normalize(Object.values(newLogs).slice(0, maxLogs))
        return dispatch({ type: "FETCH_LOGS_DONE", logs: limitedLogs })
      })
      .catch(err => {
        return dispatch({
          type: "FETCH_LOGS_ERROR",
          message: `Error occured: ${err.message}`
        })
      })
  }
}

export function setMessage(message) {
  return { type: "MESSAGE", message }
}

export function deleteAll() {
  return (dispatch, getState, sf) => {
    dispatch({ type: "DELETE_LOGS_INIT" })
    sf.deleteAll().then(() => {
      dispatch({ type: "DELETE_LOGS_DONE" })
    })
  }
}

export function search(searchTerm) {
  return async (dispatch, getState, sf) => {
    dispatch({ type: "SEARCH_INIT" })
    const logsState = getState().logs
    const logs = logsState.logs
    let logBodies = logsState.logBodies
    const fillbodiesFrom = fillFun => {
      const logIdsWithoutBodies = Object.keys(logs).filter(
        id => Object.keys(logBodies).indexOf(id) == -1
      )
      let promises = logIdsWithoutBodies.map(fillFun)
      return Promise.all(promises)
    }
    const escapeRegExp = str =>
      str.replace(/[-[]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const searchRegex = new RegExp(escapeRegExp(searchTerm), "gi")
    await fillbodiesFrom(id =>
      idbKeyval.get(id).then(body => {
        if (body) logBodies[id] = body
      })
    )
    await fillbodiesFrom(id =>
      sf.logBody(id).then(body => {
        idbKeyval.set(id, body)
        logBodies[id] = body
      })
    )
    const newLogs = Object.values(logs).reduce(
      (acc, cur) => ({
        ...acc,
        [cur.Id]: {
          ...cur,
          not_matches_search: !searchRegex.test(logBodies[cur.Id])
        }
      }),
      {}
    )
    const foundIds = Object.values(newLogs).filter(r => !r.not_matches_search)
    dispatch({
      type: "SEARCH_DONE",
      logs: newLogs,
      num: foundIds.length,
      logBodies
    })
  }
}

export function checkIsLogging() {
  return (dispatch, getState, sf) => {
    return sf
      .isLogging()
      .then(isLogging => dispatch({ type: "SET_LOGGING", isLogging }))
  }
}

export function startLogging() {
  return (dispatch, getState, sf) => {
    sf.startLogging().then(res => {
      if (res && res.success) {
        dispatch({ type: "SET_LOGGING", isLogging: true })
      } else {
        dispatch(checkIsLogging())
      }
    })
  }
}

export function checkIsLoggingAndStart() {
  return dispatch => {
    dispatch(checkIsLogging()).then(res => {
      if (!res.isLogging) dispatch(startLogging())
    })
  }
}

export function updateSearchTerm(newTerm) {
  return { type: "UPDATE_SEARCH_TERM", searchTerm: newTerm }
}

export function updateMaxLogs(maxLogs) {
  return { type: "UPDATE_MAX_LOGS", maxLogs }
}

export function toggleFiltersDialog() {
  return { type: "TOGGLE_FILTERS_DIALOG" }
}

import { filtersToWhereClause } from './utils'

const normalize = logsArray => {
  return logsArray.reduce((acc, cur) => {
    return { ...acc, [cur.Id]: cur }
  }, {})
}

export function toggleSideLogs() {
  return { type: 'TOGGLE_SIDE_LOGS' }
}

export function fetchLogBody(logId) {
  return async (dispatch, getState, sf) => {
    const logBodies = getState().logsPage.logBodies
    if (logBodies[logId]) {
      console.info('loaded log from memory')
      return
    }
    dispatch({ type: 'FETCH_LOG_BODY_INIT' })
    return sf
      .logBody(logId)
      .then(body => {
        console.info('loaded log from server')
        dispatch({ type: 'FETCH_LOG_BODY_DONE', logId, logBody: body })
      })
      .catch(err => {
        return dispatch({
          type: 'FETCH_LOGS_ERROR',
          message: `Error occured: ${err.message}`
        })
      })
  }
}

export function loadLogs() {
  return (dispatch, getState, sf) => {
    dispatch({ type: 'FETCH_LOGS_INIT' })
    dispatch({ type: 'RESET_SEARCH' })
    let { maxLogs, filters } = getState().logsPage
    if (!maxLogs || maxLogs < 1) {
      dispatch({ type: 'UPDATE_MAX_LOGS', maxLogs: 1 })
      maxLogs = 1
    }
    return sf
      .requestLogs(maxLogs, filtersToWhereClause(filters))
      .then(records => {
        return dispatch({ type: 'FETCH_LOGS_DONE', logs: normalize(records) })
      })
      .catch(err => {
        return dispatch({
          type: 'FETCH_LOGS_ERROR',
          message: `Error occured: ${err.message}`
        })
      })
  }
}

export function setMessage(message) {
  return { type: 'MESSAGE', message }
}

export function deleteAll() {
  return (dispatch, getState, sf) => {
    dispatch({ type: 'DELETE_LOGS_INIT' })
    sf.deleteAll().then(() => {
      dispatch({ type: 'DELETE_LOGS_DONE' })
    })
  }
}

// Searches the bodies of the loaded logs (up to Max Logs), ignoring case.
// Bodies are downloaded once and cached in state; a log whose body can't be
// downloaded is counted as not searched instead of failing the search.
export function search(searchTerm) {
  return async (dispatch, getState, sf) => {
    dispatch({ type: 'SEARCH_INIT' })
    const { logs } = getState().logsPage
    const logBodies = { ...getState().logsPage.logBodies }
    const missing = Object.keys(logs).filter(id => !(id in logBodies))
    // Promise.allSettled isn't in the bundled core-js 2 Promise.
    const downloaded = await Promise.all(
      missing.map(id =>
        sf
          .logBody(id)
          .then(body => (logBodies[id] = body))
          .then(
            () => true,
            () => false
          )
      )
    )
    const failed = downloaded.filter(ok => !ok).length
    const term = searchTerm.toLowerCase()
    const notMatchingSearchLogs = {}
    let found = 0
    Object.keys(logs).forEach(id => {
      const matches =
        typeof logBodies[id] === 'string' &&
        logBodies[id].toLowerCase().includes(term)
      notMatchingSearchLogs[id] = !matches
      if (matches) found++
    })
    dispatch({
      type: 'SEARCH_DONE',
      found,
      searched: Object.keys(logs).length - failed,
      failed,
      notMatchingSearchLogs,
      logBodies
    })
  }
}

export function checkIsLogging() {
  return (dispatch, getState, sf) => {
    return sf
      .isLogging()
      .then(isLogging => dispatch({ type: 'SET_LOGGING', isLogging }))
  }
}

export function startLogging() {
  return (dispatch, getState, sf) => {
    sf.startLogging().then(res => {
      if (res && res.success) {
        dispatch({ type: 'SET_LOGGING', isLogging: true })
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
  return { type: 'UPDATE_SEARCH_TERM', searchTerm: newTerm }
}

export function updateMaxLogs(maxLogs) {
  return { type: 'UPDATE_MAX_LOGS', maxLogs }
}

export function toggleFiltersDialog() {
  return { type: 'TOGGLE_FILTERS_DIALOG' }
}

export function toggleStyleDialog() {
  return { type: 'TOGGLE_STYLE_DIALOG' }
}

export function toggleContentsFilter() {
  return { type: 'TOGGLE_CONTENTS_FILTER' }
}

export function addVisibleEvents(newEvents) {
  return { type: 'ADD_VISIBLE_EVENTS', newEvents }
}

export function removeVisibleEvent(eventName) {
  return { type: 'REMOVE_VISIBLE_EVENT', eventName }
}

export function clearVisibleEvents() {
  return { type: 'CLEAR_VISIBLE_EVENTS' }
}

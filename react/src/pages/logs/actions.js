import regeneratorRuntime from 'regenerator-runtime' // eslint-disable-line
import idbKeyval from 'idb-keyval'
import { filtersToWhereClause } from './utils.js'

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
    const body = await idbKeyval.get(logId)
    if (body) {
      console.info('loaded log from cache')
      return dispatch({ type: 'FETCH_LOG_BODY_DONE', logId, logBody: body })
    }
    return sf
      .logBody(logId)
      .then(body => {
        console.info('loaded log from server')
        dispatch({ type: 'FETCH_LOG_BODY_DONE', logId, logBody: body })
        idbKeyval.set(logId, body)
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

export function search(searchTerm) {
  return async (dispatch, getState, sf) => {
    dispatch({ type: 'SEARCH_INIT' })
    let { logs, logBodies } = getState().logsPage
    const fillbodiesFrom = fillingMethod => {
      const logIdsWithoutBodies = Object.keys(logs).filter(
        id => Object.keys(logBodies).indexOf(id) == -1
      )
      let promises = logIdsWithoutBodies.map(fillingMethod)
      return Promise.all(promises)
    }

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
    const notMatchingSearchLogs = Object.values(logs).reduce(
      (acc, cur) => ({
        ...acc,
        [cur.Id]: !logBodies[cur.Id].includes(searchTerm)
      }),
      {}
    )
    const foundIds = Object.values(notMatchingSearchLogs).filter(x => !x)
    dispatch({
      type: 'SEARCH_DONE',
      foundIds: foundIds.length,
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

export function updateFilter(filterName, newValue) {
  return { type: 'UPDATE_FILTER', filterName, newValue }
}

export function clearFilters() {
  return { type: 'CLEAR_FILTERS' }
}

export function toggleStyleDialog() {
  return { type: 'TOGGLE_STYLE_DIALOG' }
}

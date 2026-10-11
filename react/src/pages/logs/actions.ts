// Thunks of the log viewer. Each gets the app's Salesforce client
// (global-sf.ts) as its third argument: (dispatch, getState, sf).
import type { AppSalesforce } from '../../global-sf'
import type { AppDispatch, RootState } from '../../store'
import {
  deleteLogsDone,
  deleteLogsInit,
  fetchLogBodyDone,
  fetchLogBodyInit,
  fetchLogsDone,
  fetchLogsInit,
  requestFailed,
  resetSearch,
  searchDone,
  searchInit,
  setLogging,
  updateMaxLogs
} from './logs-slice'
import { filtersToWhereClause, type ApexLog } from './utils'

type Thunk<R = unknown> = (
  dispatch: AppDispatch,
  getState: () => RootState,
  sf: AppSalesforce
) => R

// Every queried log has LogUser (client.ts recentLogs).
const byId = (logs: { Id: string }[]) =>
  Object.fromEntries(logs.map(log => [log.Id, log])) as Record<string, ApexLog>

export function fetchLogBody(logId: string): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    if (getState().logsPage.logBodies[logId]) return
    dispatch(fetchLogBodyInit())
    try {
      const logBody = await sf.logBody(logId)
      dispatch(fetchLogBodyDone({ logId, logBody }))
    } catch (err) {
      dispatch(requestFailed(`Error occured: ${err.message}`))
    }
  }
}

export function loadLogs(): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    dispatch(fetchLogsInit())
    dispatch(resetSearch())
    const { filters } = getState().logsPage
    let maxLogs = Number(getState().logsPage.maxLogs)
    if (!maxLogs || maxLogs < 1) {
      dispatch(updateMaxLogs(1))
      maxLogs = 1
    }
    try {
      const records = await sf.recentLogs(
        maxLogs,
        filtersToWhereClause(filters)
      )
      dispatch(fetchLogsDone(byId(records)))
    } catch (err) {
      dispatch(requestFailed(`Error occured: ${err.message}`))
    }
  }
}

export function deleteAll(): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    dispatch(deleteLogsInit())
    try {
      await sf.deleteAllLogs()
      dispatch(deleteLogsDone())
    } catch (err) {
      dispatch(requestFailed(`Deleting logs failed: ${err.message}`))
    }
  }
}

// Searches the bodies of the loaded logs (up to Max Logs), ignoring case.
// Bodies are downloaded once and cached in state; a log whose body can't be
// downloaded is counted as not searched instead of failing the search.
export function search(searchTerm: string): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    dispatch(searchInit())
    const { logs } = getState().logsPage
    const logBodies = { ...getState().logsPage.logBodies }
    const missing = Object.keys(logs).filter(id => !(id in logBodies))
    const downloads = await Promise.allSettled(
      missing.map(async id => (logBodies[id] = await sf.logBody(id)))
    )
    const failed = downloads.filter(d => d.status === 'rejected').length
    const term = searchTerm.toLowerCase()
    const notMatchingSearchLogs: Record<string, boolean> = {}
    let found = 0
    Object.keys(logs).forEach(id => {
      const matches =
        typeof logBodies[id] === 'string' &&
        logBodies[id].toLowerCase().includes(term)
      notMatchingSearchLogs[id] = !matches
      if (matches) found++
    })
    dispatch(
      searchDone({
        found,
        searched: Object.keys(logs).length - failed,
        failed,
        notMatchingSearchLogs,
        logBodies
      })
    )
  }
}

export function checkIsLogging(): Thunk<Promise<boolean>> {
  return async (dispatch, getState, sf) => {
    const isLogging = await sf.isTracing(await sf.getUserId())
    dispatch(setLogging(isLogging))
    return isLogging
  }
}

export function startLogging(): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    try {
      const res = await sf.traceUser(await sf.getUserId())
      if (res && res.success) {
        dispatch(setLogging(true))
        return
      }
    } catch {
      // Whether a flag exists anyway is checked below.
    }
    await dispatch(checkIsLogging())
  }
}

// On start: makes sure the current user's actions are logged.
export function checkIsLoggingAndStart(): Thunk<Promise<void>> {
  return async dispatch => {
    if (!(await dispatch(checkIsLogging()))) await dispatch(startLogging())
  }
}

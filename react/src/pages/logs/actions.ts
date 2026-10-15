// Thunks of the log viewer. Each gets the app's Salesforce client
// (global-sf.ts) as its third argument: (dispatch, getState, sf).
import type { AppSalesforce } from '../../global-sf'
import type { AppDispatch, RootState } from '../../store'
import { explainError } from '../../core/salesforce/errors'
import {
  DEBUG_LEVEL_NAME,
  type DebugLevelInfo,
  type DeleteProgress,
  type TraceFlagInfo
} from '../../core/salesforce/client'
import {
  entityKind,
  logTypeFor,
  type CategoryLevels
} from '../../core/salesforce/trace-flags'
import {
  bodyFailed,
  bodyLoaded,
  bodyRequested,
  loggingBusy,
  loggingFailed,
  loggingStatus,
  logsFailed,
  logsLoaded,
  logsPolled,
  logsRequested,
  PAGE_SIZE,
  searchCleared,
  searchFinished,
  searchProgress,
  searchStarted,
  setFilter,
  clearFilters as clearFiltersAction,
  setMaxLogs,
  showToast
} from './logs-slice'
import {
  filtersToWhereClause,
  formatClock,
  type ApexLog,
  type ListFilters
} from './utils'
import { newestModified, newLogsWhereClause } from './auto-refresh'

type Thunk<R = unknown> = (
  dispatch: AppDispatch,
  getState: () => RootState,
  sf: AppSalesforce
) => R

const explain = (err: unknown, sf: AppSalesforce) =>
  explainError(err, sf.hostname)

// Loads the newest logs that pass the filters (maxLogs of them; `more`
// loads another page).
export function loadLogs({ more = false } = {}): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    if (more) dispatch(setMaxLogs(getState().logsPage.maxLogs + PAGE_SIZE))
    const { filters, maxLogs } = getState().logsPage
    dispatch(logsRequested())
    try {
      const records = await sf.recentLogs(
        maxLogs,
        filtersToWhereClause(filters)
      )
      dispatch(logsLoaded({ logs: records as ApexLog[], at: Date.now() }))
      const { search } = getState().logsPage
      if (search.term) await dispatch(searchLogs(search.term))
    } catch (err) {
      dispatch(logsFailed(explain(err, sf)))
    }
  }
}

// One auto-refresh poll: asks only for the logs not older than the newest
// loaded one (with the list's filters) and adds the new ones on top, keeping
// the open log (keepId) in the list. Resolves with how many were new;
// rejects when Salesforce can't be reached (auto-refresh.ts backs off).
// A full load running or done meanwhile wins over the poll's result.
export function pollNewLogs({
  keepId = null
}: { keepId?: string | null } = {}): Thunk<Promise<number>> {
  return async (dispatch, getState, sf) => {
    const { logs, filters, maxLogs, listStatus } = getState().logsPage
    if (listStatus === 'loading') return 0
    const records = (await sf.recentLogs(
      maxLogs,
      newLogsWhereClause(filters, newestModified(logs))
    )) as ApexLog[]
    const now = getState().logsPage
    if (
      now.listStatus === 'loading' ||
      now.logs !== logs ||
      now.filters !== filters
    )
      return 0
    const known = new Set(logs.map(log => log.Id))
    const added = new Set(
      records.filter(log => !known.has(log.Id)).map(log => log.Id)
    ).size
    dispatch(logsPolled({ logs: records, at: Date.now(), keepId }))
    const { search } = getState().logsPage
    if (added && search.term) await dispatch(searchLogs(search.term))
    return added
  }
}

// Sets one list filter and reloads the list from Salesforce with it.
export function applyFilter(
  key: keyof ListFilters,
  value: string | number
): Thunk<Promise<void>> {
  return async dispatch => {
    dispatch(setFilter({ key, value }))
    await dispatch(loadLogs())
  }
}

export function clearFilters(): Thunk<Promise<void>> {
  return async dispatch => {
    dispatch(clearFiltersAction())
    await dispatch(loadLogs())
  }
}

export function fetchLogBody(
  logId: string,
  { retry = false } = {}
): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    const { logBodies, bodyLoading, bodyErrors } = getState().logsPage
    if (logId in logBodies || bodyLoading[logId]) return
    if (bodyErrors[logId] && !retry) return
    dispatch(bodyRequested(logId))
    try {
      dispatch(bodyLoaded({ logId, body: await sf.logBody(logId) }))
    } catch (err) {
      dispatch(bodyFailed({ logId, error: explain(err, sf) }))
    }
  }
}

// Occurrences of `term` (already lower case) in `body`, ignoring case.
export function countOccurrences(body: string, term: string): number {
  if (!term) return 0
  const text = body.toLowerCase()
  let count = 0
  for (
    let at = text.indexOf(term);
    at >= 0;
    at = text.indexOf(term, at + term.length)
  )
    count++
  return count
}

// How many bodies are downloaded at the same time while searching.
const SEARCH_CONCURRENCY = 4
let searchRun = 0

// Searches the loaded logs' bodies for `term`, ignoring case. Downloads the
// bodies not cached yet (a few at a time, reporting progress) and keeps
// them; a body that can't be downloaded counts as failed, not as a miss.
// A newer search (or clearing it) makes an older one stop reporting.
export function searchLogs(term: string): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    const run = ++searchRun
    const needle = term.trim().toLowerCase()
    if (!needle) {
      dispatch(searchCleared())
      return
    }
    const { logs } = getState().logsPage
    dispatch(searchStarted({ term: term.trim(), total: logs.length }))
    const queue = logs.map(log => log.Id)
    let done = 0
    let failed = 0
    const failedIds = new Set<string>()
    const worker = async () => {
      while (queue.length && run === searchRun) {
        const id = queue.shift()
        if (!(id in getState().logsPage.logBodies)) {
          try {
            const body = await sf.logBody(id)
            dispatch(bodyLoaded({ logId: id, body }))
          } catch {
            failed++
            failedIds.add(id)
          }
        }
        done++
        if (run === searchRun) dispatch(searchProgress({ done, failed }))
      }
    }
    await Promise.all(Array.from({ length: SEARCH_CONCURRENCY }, worker))
    if (run !== searchRun) return
    const bodies = getState().logsPage.logBodies
    const matches: Record<string, number> = {}
    for (const log of logs) {
      matches[log.Id] = failedIds.has(log.Id)
        ? 0
        : countOccurrences(bodies[log.Id] || '', needle)
    }
    dispatch(searchFinished({ matches, failed }))
  }
}

export function clearSearch(): Thunk<void> {
  return dispatch => {
    searchRun++
    dispatch(searchCleared())
  }
}

// Reads whether the current user's actions are logged, and until when. Never
// starts logging by itself (docs/ux/baseline-review.md M11).
export function checkLogging(): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    try {
      dispatch(loggingStatus(await sf.traceStatus(await sf.getUserId())))
    } catch (err) {
      dispatch(loggingFailed(explain(err, sf)))
    }
  }
}

function changeLogging(
  change: (sf: AppSalesforce, userId: string) => Promise<unknown>,
  message: (status: { active: boolean; expiresAt?: string }) => string
): Thunk<Promise<void>> {
  return async (dispatch, getState, sf) => {
    dispatch(loggingBusy())
    try {
      const userId = await sf.getUserId()
      await change(sf, userId)
      const status = await sf.traceStatus(userId)
      dispatch(loggingStatus(status))
      dispatch(
        showToast(message(status as { active: boolean; expiresAt?: string }))
      )
    } catch (err) {
      dispatch(loggingFailed(explain(err, sf)))
    }
  }
}

export const startLogging = () =>
  changeLogging(
    (sf, userId) => sf.traceUser(userId),
    s =>
      s.active
        ? `Logging started, until ${formatClock(s.expiresAt)}`
        : 'Salesforce did not start logging'
  )

export const extendLogging = () =>
  changeLogging(
    (sf, userId) => sf.extendTracing(userId),
    s =>
      s.active
        ? `Logging extended until ${formatClock(s.expiresAt)}`
        : 'Logging is off'
  )

export const stopLogging = () =>
  changeLogging(
    (sf, userId) => sf.stopTracing(userId),
    s =>
      s.active
        ? 'Logging is still on (another trace flag is active)'
        : 'Logging stopped'
  )

export type DeleteScope = 'mine' | 'all'

// How many logs each delete scope covers.
export function countLogs(): Thunk<Promise<{ mine: number; all: number }>> {
  return async (dispatch, getState, sf) => {
    const userId = await sf.getUserId()
    const [mine, all] = await Promise.all([
      sf.countLogs({ scope: 'user', userId }),
      sf.countLogs({ scope: 'all' })
    ])
    return { mine, all }
  }
}

// Deletes the current user's logs or every log of the org, then confirms
// and reloads the list. Rejects (for the dialog to show) when it fails.
export function deleteLogs(
  scope: DeleteScope,
  onProgress: (progress: DeleteProgress) => void
): Thunk<Promise<number>> {
  return async (dispatch, getState, sf) => {
    // 'mine' needs the user's id; the client refuses a missing one rather
    // than deleting every user's logs.
    const deleted = await sf.deleteLogs(
      scope === 'all'
        ? { scope: 'all' }
        : { scope: 'user', userId: await sf.getUserId() },
      { onProgress }
    )
    dispatch(
      showToast(
        deleted === 1
          ? 'Deleted 1 log'
          : `Deleted ${deleted.toLocaleString()} logs`
      )
    )
    await dispatch(loadLogs())
    return deleted
  }
}

// --- Trace flags (the "Trace flags" dialog) ---------------------------------

// Whom or what to trace: the current user, another user, the org's
// Automated Process user, or an Apex class or trigger.
export type TraceTarget =
  | { kind: 'me' }
  | { kind: 'automated' }
  | { kind: 'user'; id: string; name: string }
  | { kind: 'code'; id: string; name: string }

// The debug level of a new flag: the extension's (DEBUG for every
// category), one of the org's, or the extension's custom level set to
// these levels.
export type TraceLevelChoice =
  | { kind: 'default' }
  | { kind: 'existing'; id: string }
  | { kind: 'custom'; levels: CategoryLevels }

// The org's active trace flags and debug levels, and the current user's id
// (to tell their own flags apart).
export function loadTraceSetup(): Thunk<
  Promise<{
    flags: TraceFlagInfo[]
    debugLevels: DebugLevelInfo[]
    userId: string
  }>
> {
  return async (dispatch, getState, sf) => {
    const [flags, debugLevels, userId] = await Promise.all([
      sf.activeTraceFlags(),
      sf.debugLevels(),
      sf.getUserId()
    ])
    return { flags, debugLevels, userId }
  }
}

// Users (kind 'user') or Apex classes and triggers (kind 'code') matching
// the term, as { id, name, detail } options.
export function findTraceTargets(
  kind: 'user' | 'code',
  term: string
): Thunk<Promise<{ id: string; name: string; detail: string }[]>> {
  return async (dispatch, getState, sf) => {
    if (kind === 'user') {
      return (await sf.searchUsers(term)).map(u => ({
        id: u.id,
        name: u.name,
        detail: u.username
      }))
    }
    return (await sf.searchApexCode(term)).map(c => ({
      id: c.id,
      name: c.name,
      detail: c.kind === 'trigger' ? 'Trigger' : 'Class'
    }))
  }
}

async function resolveTarget(
  target: TraceTarget,
  sf: AppSalesforce
): Promise<{ entityId: string; name: string }> {
  if (target.kind === 'me') return { entityId: await sf.getUserId(), name: '' }
  if (target.kind === 'automated') {
    const user = await sf.automatedProcessUser()
    if (!user) throw new Error('This org has no Automated Process user')
    return { entityId: user.id, name: user.name }
  }
  return { entityId: target.id, name: target.name }
}

async function resolveDebugLevel(
  level: TraceLevelChoice,
  sf: AppSalesforce
): Promise<string> {
  if (level.kind === 'existing') return level.id
  if (level.kind === 'custom') return sf.saveCustomDebugLevel(level.levels)
  return sf.getOrCreateDebugLevel(DEBUG_LEVEL_NAME)
}

// Traces the target from now for durationMs with the chosen debug level
// (updating its active flag if it has one), confirms it, refreshes the
// header's logging status and resolves with the active flags. Only ever
// runs on the user's request. Rejects for the dialog to show.
export function startTrace({
  target,
  level,
  durationMs
}: {
  target: TraceTarget
  level: TraceLevelChoice
  durationMs: number
}): Thunk<Promise<TraceFlagInfo[]>> {
  return async (dispatch, getState, sf) => {
    const { entityId, name } = await resolveTarget(target, sf)
    const debugLevelId = await resolveDebugLevel(level, sf)
    const kind = entityKind(entityId)
    const { id } = await sf.setTraceFlag({
      entityId,
      logType: logTypeFor(kind),
      debugLevelId,
      durationMs
    })
    const flags = await sf.activeTraceFlags()
    const flag = flags.find(f => f.id === id)
    const until = flag ? ` until ${formatClock(flag.expiresAt)}` : ''
    dispatch(
      showToast(
        target.kind === 'me'
          ? `Logging your actions${until}`
          : `Tracing ${name}${until}`
      )
    )
    await dispatch(checkLogging())
    return flags
  }
}

// Ends one trace flag, confirms it, refreshes the header's logging status
// and resolves with the remaining active flags.
export function stopTrace(
  flag: TraceFlagInfo
): Thunk<Promise<TraceFlagInfo[]>> {
  return async (dispatch, getState, sf) => {
    await sf.deleteTraceFlag(flag.id)
    dispatch(showToast(`Stopped tracing ${flag.entityName || flag.entityId}`))
    await dispatch(checkLogging())
    return sf.activeTraceFlags()
  }
}

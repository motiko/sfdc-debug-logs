// The log viewer's state (state.logsPage): the loaded logs and their bodies,
// search, list filters, the user's logging status, the confirmation toast,
// and the user's settings (appearance, hidden event categories, list size).
// Thunks that call Salesforce are in actions.ts.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { AUTO_THEME, type CustomColors } from '../../core/log/themes'
import type { LogCategory } from '../../core/log/categories'
import type { ExplainedError } from '../../core/salesforce/errors'
import type { ColorModePreference } from '../../ui/tokens'
import { NO_FILTERS, type ApexLog, type ListFilters } from './utils'

export const DEFAULT_FONT_SIZE = 13
export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 24
export const PAGE_SIZE = 50

export interface StyleConfig {
  // A palette of core/log/themes.ts, or AUTO_THEME (light or dark, following
  // the app's color mode).
  theme: string
  // The user's own colors on top of the palette.
  colors: CustomColors
  fontSize: number
  textWrap: boolean
}

export const defaultStyleConfig: StyleConfig = {
  theme: AUTO_THEME,
  colors: {},
  fontSize: DEFAULT_FONT_SIZE,
  textWrap: true
}

export interface LoggingState {
  // unknown: not checked yet (or being checked).
  status: 'unknown' | 'on' | 'off' | 'error'
  expiresAt: string | null
  debugLevel: string | null
  // A start, stop or extend request is running.
  busy: boolean
  error: ExplainedError | null
}

export interface SearchState {
  term: string
  status: 'idle' | 'searching' | 'done'
  // Bodies downloaded (or failed) so far, of `total` to search.
  done: number
  total: number
  failed: number
  // Log id -> occurrences of the term; null while no search is active.
  matches: Record<string, number> | null
}

export const idleSearch: SearchState = {
  term: '',
  status: 'idle',
  done: 0,
  total: 0,
  failed: 0,
  matches: null
}

export interface LogsPageState {
  // Newest first, as Salesforce returned them.
  logs: ApexLog[]
  listStatus: 'idle' | 'loading' | 'ready' | 'error'
  listError: ExplainedError | null
  loadedAt: number | null
  // Logs that weren't in the list before the last refresh.
  newIds: Record<string, true>
  logBodies: Record<string, string>
  bodyLoading: Record<string, true>
  bodyErrors: Record<string, ExplainedError>
  search: SearchState
  filters: ListFilters
  logging: LoggingState
  // Logs checked in the list for "Delete selected" (ids of loaded logs).
  selectedIds: Record<string, true>
  // A confirmation ("Deleted 36 logs"); key changes for each new one.
  toast: { key: number; message: string } | null
  // Persisted (see persisted-settings.ts):
  maxLogs: number
  sideLogsOpen: boolean
  styleConfig: StyleConfig
  hiddenCategories: LogCategory[]
  colorMode: ColorModePreference
}

export const initialLogsPageState: LogsPageState = {
  logs: [],
  listStatus: 'idle',
  listError: null,
  loadedAt: null,
  newIds: {},
  logBodies: {},
  bodyLoading: {},
  bodyErrors: {},
  search: idleSearch,
  filters: NO_FILTERS,
  logging: {
    status: 'unknown',
    expiresAt: null,
    debugLevel: null,
    busy: false,
    error: null
  },
  selectedIds: {},
  toast: null,
  maxLogs: PAGE_SIZE,
  sideLogsOpen: true,
  styleConfig: defaultStyleConfig,
  hiddenCategories: [],
  colorMode: 'system'
}

const logsSlice = createSlice({
  name: 'logsPage',
  initialState: initialLogsPageState,
  reducers: {
    // The list.
    logsRequested(state) {
      state.listStatus = 'loading'
      state.listError = null
    },
    logsLoaded(state, action: PayloadAction<{ logs: ApexLog[]; at: number }>) {
      const before = new Set(state.logs.map(log => log.Id))
      const { logs, at } = action.payload
      state.newIds =
        state.loadedAt === null
          ? {}
          : Object.fromEntries(
              logs.filter(log => !before.has(log.Id)).map(log => [log.Id, true])
            )
      state.logs = logs
      // A selection only covers logs that are still listed.
      const listed = new Set(logs.map(log => log.Id))
      for (const id of Object.keys(state.selectedIds))
        if (!listed.has(id)) delete state.selectedIds[id]
      state.listStatus = 'ready'
      state.loadedAt = at
    },
    logsFailed(state, action: PayloadAction<ExplainedError>) {
      state.listStatus = 'error'
      state.listError = action.payload
    },
    setMaxLogs(state, action: PayloadAction<number>) {
      state.maxLogs = Math.max(1, Math.floor(action.payload) || PAGE_SIZE)
    },

    // Selection (for "Delete selected").
    toggleLogSelected(state, action: PayloadAction<string>) {
      if (state.selectedIds[action.payload])
        delete state.selectedIds[action.payload]
      else if (state.logs.some(log => log.Id === action.payload))
        state.selectedIds[action.payload] = true
    },
    // Checks (or unchecks) these logs, e.g. every shown log.
    setLogsSelected(
      state,
      action: PayloadAction<{ ids: string[]; selected: boolean }>
    ) {
      const listed = new Set(state.logs.map(log => log.Id))
      for (const id of action.payload.ids) {
        if (!action.payload.selected) delete state.selectedIds[id]
        else if (listed.has(id)) state.selectedIds[id] = true
      }
    },
    clearSelection(state) {
      state.selectedIds = {}
    },
    // Logs deleted in Salesforce: gone from the list, the selection, the
    // cached bodies and the search results.
    logsDeleted(state, action: PayloadAction<string[]>) {
      const gone = new Set(action.payload)
      state.logs = state.logs.filter(log => !gone.has(log.Id))
      for (const id of gone) {
        delete state.selectedIds[id]
        delete state.newIds[id]
        delete state.logBodies[id]
        delete state.bodyLoading[id]
        delete state.bodyErrors[id]
        if (state.search.matches) delete state.search.matches[id]
      }
    },

    // Log bodies.
    bodyRequested(state, action: PayloadAction<string>) {
      state.bodyLoading[action.payload] = true
      delete state.bodyErrors[action.payload]
    },
    bodyLoaded(state, action: PayloadAction<{ logId: string; body: string }>) {
      delete state.bodyLoading[action.payload.logId]
      state.logBodies[action.payload.logId] = action.payload.body
    },
    bodyFailed(
      state,
      action: PayloadAction<{ logId: string; error: ExplainedError }>
    ) {
      delete state.bodyLoading[action.payload.logId]
      state.bodyErrors[action.payload.logId] = action.payload.error
    },

    // Search in the loaded logs' bodies.
    searchStarted(
      state,
      action: PayloadAction<{ term: string; total: number }>
    ) {
      state.search = {
        ...idleSearch,
        ...action.payload,
        status: 'searching',
        matches: state.search.matches
      }
    },
    searchProgress(
      state,
      action: PayloadAction<{ done: number; failed: number }>
    ) {
      Object.assign(state.search, action.payload)
    },
    searchFinished(
      state,
      action: PayloadAction<{ matches: Record<string, number>; failed: number }>
    ) {
      state.search.status = 'done'
      state.search.done = state.search.total
      state.search.matches = action.payload.matches
      state.search.failed = action.payload.failed
    },
    searchCleared(state) {
      state.search = idleSearch
    },

    // List filters.
    setFilter(
      state,
      action: PayloadAction<{ key: keyof ListFilters; value: string | number }>
    ) {
      ;(state.filters as unknown as Record<string, string | number>)[
        action.payload.key
      ] = action.payload.value
    },
    clearFilters(state) {
      state.filters = NO_FILTERS
    },

    // Logging (the user's trace flag).
    loggingBusy(state) {
      state.logging.busy = true
      state.logging.error = null
    },
    loggingStatus(
      state,
      action: PayloadAction<{
        active: boolean
        expiresAt?: string
        debugLevel?: string | null
      }>
    ) {
      const { active, expiresAt = null, debugLevel = null } = action.payload
      state.logging = {
        status: active ? 'on' : 'off',
        expiresAt,
        debugLevel,
        busy: false,
        error: null
      }
    },
    loggingFailed(state, action: PayloadAction<ExplainedError>) {
      state.logging.busy = false
      state.logging.error = action.payload
      if (state.logging.status === 'unknown') state.logging.status = 'error'
    },

    // Confirmations.
    showToast(state, action: PayloadAction<string>) {
      state.toast = {
        key: (state.toast ? state.toast.key : 0) + 1,
        message: action.payload
      }
    },
    hideToast(state) {
      state.toast = null
    },

    // Layout.
    toggleSideLogs(state) {
      state.sideLogsOpen = !state.sideLogsOpen
    },

    // Appearance.
    setColorMode(state, action: PayloadAction<ColorModePreference>) {
      state.colorMode = action.payload
    },
    setTheme(state, action: PayloadAction<string>) {
      state.styleConfig.theme = action.payload
    },
    setCustomColor(
      state,
      action: PayloadAction<{ key: keyof CustomColors; color: string }>
    ) {
      state.styleConfig.colors = {
        ...state.styleConfig.colors,
        [action.payload.key]: action.payload.color
      }
    },
    resetColors(state) {
      state.styleConfig.colors = {}
    },
    restoreColors(state, action: PayloadAction<CustomColors>) {
      state.styleConfig.colors = action.payload
    },
    setFontSize(state, action: PayloadAction<number>) {
      const size = Math.round(Number(action.payload))
      if (size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE)
        state.styleConfig.fontSize = size
    },
    setTextWrap(state, action: PayloadAction<boolean>) {
      state.styleConfig.textWrap = action.payload
    },

    // Event categories shown in the log body.
    toggleCategory(state, action: PayloadAction<LogCategory>) {
      const hidden = new Set(state.hiddenCategories)
      if (hidden.has(action.payload)) hidden.delete(action.payload)
      else hidden.add(action.payload)
      state.hiddenCategories = [...hidden]
    },
    showAllCategories(state) {
      state.hiddenCategories = []
    },

    // Settings another page (the options page, another app tab) saved.
    settingsLoaded(state, action: PayloadAction<Partial<LogsPageState>>) {
      Object.assign(state, action.payload)
    }
  }
})

export const {
  logsRequested,
  logsLoaded,
  logsFailed,
  setMaxLogs,
  toggleLogSelected,
  setLogsSelected,
  clearSelection,
  logsDeleted,
  bodyRequested,
  bodyLoaded,
  bodyFailed,
  searchStarted,
  searchProgress,
  searchFinished,
  searchCleared,
  setFilter,
  clearFilters,
  loggingBusy,
  loggingStatus,
  loggingFailed,
  showToast,
  hideToast,
  toggleSideLogs,
  setColorMode,
  setTheme,
  setCustomColor,
  resetColors,
  restoreColors,
  setFontSize,
  setTextWrap,
  toggleCategory,
  showAllCategories,
  settingsLoaded
} = logsSlice.actions

export default logsSlice.reducer

// The log viewer's state (state.logsPage): loaded logs and bodies, search
// results, dialogs, and the user's settings (log style, list filters, visible
// event types). Thunks that call Salesforce are in actions.ts.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { appTheme, DEFAULT_THEME, type AppTheme } from '../../core/log/themes'
import type { ApexLog, Filters } from './utils'

export interface StyleConfig {
  theme: AppTheme
  fontSize: number
  textWrap: boolean
}

export const defaultStyleConfig: StyleConfig = {
  theme: appTheme(DEFAULT_THEME),
  fontSize: 19,
  textWrap: true
}

export const defaultFilters: Filters = {
  user: { type: 'text', value: '' },
  operation: { type: 'text', value: '' },
  status: { type: 'text', value: '' },
  length: { type: 'number', value: [0, 2.5 * Math.pow(10, 6)] },
  duration: { type: 'number', value: [0, 2 * 6 * Math.pow(10, 3)] }
}

export interface LogsPageState {
  logs: Record<string, ApexLog>
  logBodies: Record<string, string>
  // Log id -> true when the last search didn't find the term in its body.
  notMatchingSearchLogs: Record<string, boolean>
  loading: boolean
  // Shown in the snackbar; '' hides it.
  message: string
  isLogging?: boolean
  filtersDialogOpen: boolean
  styleDialogOpen: boolean
  contentsFilterOpen: boolean
  filters: Filters
  // Persisted to sessionStorage (see persisted-settings.ts):
  maxLogs: number
  sideLogsOpen: boolean
  styleConfig: StyleConfig
  visibleEvents: string[]
}

export const initialLogsPageState: LogsPageState = {
  logs: {},
  logBodies: {},
  notMatchingSearchLogs: {},
  loading: false,
  message: '',
  filtersDialogOpen: false,
  styleDialogOpen: false,
  contentsFilterOpen: false,
  filters: defaultFilters,
  maxLogs: 50,
  sideLogsOpen: true,
  styleConfig: defaultStyleConfig,
  visibleEvents: []
}

export interface SearchResult {
  found: number
  searched: number
  failed: number
  notMatchingSearchLogs: Record<string, boolean>
  logBodies: Record<string, string>
}

const logsSlice = createSlice({
  name: 'logsPage',
  initialState: initialLogsPageState,
  reducers: {
    resetSearch(state) {
      state.notMatchingSearchLogs = {}
    },
    updateMaxLogs(state, action: PayloadAction<number | string>) {
      state.maxLogs = action.payload as number
    },
    toggleSideLogs(state) {
      state.sideLogsOpen = !state.sideLogsOpen
    },
    fetchLogsInit(state) {
      state.loading = true
    },
    fetchLogsDone(state, action: PayloadAction<Record<string, ApexLog>>) {
      state.loading = false
      state.logs = action.payload
      state.message = `Loaded ${Object.keys(action.payload).length} logs`
    },
    // Any failed Salesforce call: stop the spinner and show the error.
    requestFailed(state, action: PayloadAction<string>) {
      state.loading = false
      state.message = action.payload
    },
    setMessage(state, action: PayloadAction<string>) {
      state.message = action.payload
    },
    deleteLogsInit(state) {
      state.loading = true
      state.logs = {}
    },
    deleteLogsDone(state) {
      state.loading = false
      state.message = 'Removed logs from salesforce'
    },
    searchInit(state) {
      state.loading = true
    },
    searchDone(state, action: PayloadAction<SearchResult>) {
      const { found, searched, failed, notMatchingSearchLogs, logBodies } =
        action.payload
      state.loading = false
      state.message =
        `Found ${found} matching logs in ${searched} searched` +
        (failed ? ` (${failed} could not be downloaded)` : '')
      state.notMatchingSearchLogs = notMatchingSearchLogs
      state.logBodies = logBodies
    },
    setLogging(state, action: PayloadAction<boolean>) {
      state.isLogging = action.payload
    },
    fetchLogBodyInit(state) {
      state.loading = true
    },
    fetchLogBodyDone(
      state,
      action: PayloadAction<{ logId: string; logBody: string }>
    ) {
      state.loading = false
      state.logBodies[action.payload.logId] = action.payload.logBody
    },
    toggleFiltersDialog(state) {
      state.filtersDialogOpen = !state.filtersDialogOpen
    },
    toggleStyleDialog(state) {
      state.styleDialogOpen = !state.styleDialogOpen
    },
    toggleContentsFilter(state) {
      state.contentsFilterOpen = !state.contentsFilterOpen
    },

    // Log style (style dialog).
    updateTheme(state, action: PayloadAction<AppTheme>) {
      state.styleConfig.theme = action.payload
    },
    updateColor(
      state,
      action: PayloadAction<{ propName: string; newColor: string }>
    ) {
      state.styleConfig.theme[action.payload.propName] = action.payload.newColor
    },
    toggleTextWrap(state) {
      state.styleConfig.textWrap = !state.styleConfig.textWrap
    },
    updateFontSize(state, action: PayloadAction<number | string>) {
      state.styleConfig.fontSize = parseInt(String(action.payload))
    },

    // Log list filters (filter dialog).
    updateFilter(
      state,
      action: PayloadAction<{
        filterName: string
        newValue: Filters[string]['value']
      }>
    ) {
      const { filterName, newValue } = action.payload
      state.filters[filterName].value = newValue
    },
    clearFilters(state) {
      state.filters = defaultFilters
    },

    // Event types shown in the log body (contents filter); all when empty.
    addVisibleEvents(state, action: PayloadAction<string[]>) {
      state.visibleEvents = [
        ...new Set([...state.visibleEvents, ...action.payload])
      ]
    },
    removeVisibleEvent(state, action: PayloadAction<string>) {
      state.visibleEvents = state.visibleEvents.filter(
        event => event !== action.payload
      )
    },
    clearVisibleEvents(state) {
      state.visibleEvents = []
    }
  }
})

export const {
  resetSearch,
  updateMaxLogs,
  toggleSideLogs,
  fetchLogsInit,
  fetchLogsDone,
  requestFailed,
  setMessage,
  deleteLogsInit,
  deleteLogsDone,
  searchInit,
  searchDone,
  setLogging,
  fetchLogBodyInit,
  fetchLogBodyDone,
  toggleFiltersDialog,
  toggleStyleDialog,
  toggleContentsFilter,
  updateTheme,
  updateColor,
  toggleTextWrap,
  updateFontSize,
  updateFilter,
  clearFilters,
  addVisibleEvents,
  removeVisibleEvent,
  clearVisibleEvents
} = logsSlice.actions

export default logsSlice.reducer

import { defaultLogThemes } from './constants'
import { defaultStyleConfig, styleConfigReducer } from './dialogs/style/reducer'
import { defaultFiltersState, filtersReducer } from './dialogs/filter/reducer'
import {
  defaultVisibleEvents,
  visibleEventsReducer
} from './dialogs/log-content-filter/reducer'

export const defaultInnerLogsState = {
  logs: {},
  logBodies: {},
  notMatchingSearchLogs: {},
  loading: false,
  message: '',
  sideLogsOpen: true,
  filtersDialogOpen: false,
  styleDialogOpen: false,
  contentsFilterOpen: false,
  maxLogs: 50
}

function innerLogsReducer(state = defaultInnerLogsState, action) {
  switch (action.type) {
    case 'RESET_SEARCH':
      return {
        ...state,
        searchTerm: '',
        notMatchingSearchLogs: {}
      }
    case 'UPDATE_MAX_LOGS':
      return {
        ...state,
        maxLogs: action.maxLogs
      }
    case 'UPDATE_SEARCH_TERM':
      return {
        ...state,
        searchTerm: action.searchTerm,
        notMatchingSearchLogs:
          action.searchTerm == '' ? {} : state.notMatchingSearchLogs
      }
    case 'TOGGLE_SIDE_LOGS':
      return {
        ...state,
        sideLogsOpen: !state.sideLogsOpen
      }
    case 'FETCH_LOGS_DONE':
      return {
        ...state,
        loading: false,
        lastUpdated: Date.now(),
        logs: action.logs,
        message: `Loaded ${Object.keys(action.logs).length} logs`
      }
    case 'FETCH_LOGS_INIT':
      return {
        ...state,
        loading: true
      }
    case 'FETCH_LOGS_ERROR':
      return {
        ...state,
        loading: false,
        message: action.message
      }
    case 'MESSAGE':
      return {
        ...state,
        message: action.message
      }
    case 'DELETE_LOGS_INIT':
      return {
        ...state,
        loading: true,
        logs: [],
        searchTerm: ''
      }
    case 'DELETE_LOGS_DONE':
      return {
        ...state,
        message: 'Removed logs from salesforce',
        loading: false
      }
    case 'SEARCH_INIT':
      return {
        ...state,
        loading: true
      }
    case 'SEARCH_DONE':
      return {
        ...state,
        loading: false,
        message: `Found ${action.foundIds} matching logs`,
        notMatchingSearchLogs: action.notMatchingSearchLogs,
        logBodies: action.logBodies
      }
    case 'SET_LOGGING':
      return {
        ...state,
        isLogging: action.isLogging
      }
    case 'FETCH_LOG_BODY_INIT':
      return {
        ...state,
        loading: true
      }
    case 'FETCH_LOG_BODY_DONE':
      return {
        ...state,
        loading: false,
        logBodies: { ...state.logBodies, [action.logId]: action.logBody }
      }
    case 'TOGGLE_FILTERS_DIALOG':
      return {
        ...state,
        filtersDialogOpen: !state.filtersDialogOpen
      }
    case 'TOGGLE_STYLE_DIALOG':
      return {
        ...state,
        styleDialogOpen: !state.styleDialogOpen
      }
    case 'TOGGLE_CONTENTS_FILTER':
      return {
        ...state,
        contentsFilterOpen: !state.contentsFilterOpen
      }
    default:
      return state
  }
}

export default function logs(
  state = {
    ...defaultInnerLogsState,
    styleConfig: defaultStyleConfig,
    filters: defaultFiltersState,
    visibleEvents: defaultVisibleEvents
  },
  action
) {
  return {
    ...innerLogsReducer(state, action),
    styleConfig: styleConfigReducer(state.styleConfig, action),
    filters: filtersReducer(state.filters, action),
    visibleEvents: visibleEventsReducer(state.visibleEvents, action)
  }
}

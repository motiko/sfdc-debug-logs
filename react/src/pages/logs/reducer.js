const initalLogsState = {
  logs: {},
  logBodies: {},
  notMatchingSearchLogs: {},
  loading: false,
  message: '',
  sideLogsOpen: true,
  searchTerm: '',
  maxLogs: 50,
  filtersDialogOpen: false,
  filters: {
    user: '',
    operation: '',
    status: ''
  }
}

export default function logs(state = initalLogsState, action) {
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
        searchTerm: action.searchTerm
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
    case 'UPDATE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.filterName]: action.newValue
        }
      }
    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: initalLogsState.filters
      }
    default:
      return state
  }
}

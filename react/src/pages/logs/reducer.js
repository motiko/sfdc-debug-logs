
const initalLogsState = {
  logs: [],
  loading: false,
  message: ''
}

export default function logs (state = initalLogsState, action) {
  switch (action.type) {
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
        loading: true,
        searchTerm: ''
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
        message: `Found ${action.num} matching logs`,
        logs: action.logs
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
        logs: action.logs
      }
    default:
      return state
  }
}

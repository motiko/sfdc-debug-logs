const initalLogsState = {
  logs: {},
  logBodies: {},
  notMatchingSearchLogs: {},
  loading: false,
  message: '',
  sideLogsOpen: true,
  maxLogs: 50,
  filtersDialogOpen: false,
  styleDialogOpen: false,
  styleConfig: {
    theme: 'dark',
    fontSize: 19
  },
  filters: {
    user: { type: 'text', value: '' },
    operation: { type: 'text', value: '' },
    status: { type: 'text', value: '' },
    length: { type: 'number', value: [0, 2 * Math.pow(10, 6)] },
    duration: { type: 'number', value: [0, 2 * 6 * Math.pow(10, 3)] },
    start: { type: 'date', value: [0, 0] }
  },
  visibleEvents: [],
  contentsFilterOpen: true
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
    case 'UPDATE_FONT_SIZE':
      return {
        ...state,
        styleConfig: {
          ...state.styleConfig,
          fontSize: action.newSize
        }
      }
    case 'UPDATE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.filterName]: {
            ...state.filters[action.filterName],
            value: action.newValue
          }
        }
      }
    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: initalLogsState.filters
      }
    case 'UPDATE_THEME':
      return {
        ...state,
        styleConfig: {
          ...state.styleConfig,
          theme: action.newTheme
        }
      }
    case 'TOGGLE_CONTENTS_FILTER':
      return {
        ...state,
        contentsFilterOpen: !state.contentsFilterOpen
      }
    case 'ADD_VISIBLE_EVENTS':
      return {
        ...state,
        visibleEvents: [
          ...new Set([...state.visibleEvents, ...action.newEvents])
        ]
      }
    case 'REMOVE_VISIBLE_EVENT':
      return {
        ...state,
        visibleEvents: state.visibleEvents.filter(
          event => event !== action.eventName
        )
      }
    case 'CLEAR_VISIBLE_EVENTS':
      return {
        ...state,
        visibleEvents: []
      }
    default:
      return state
  }
}

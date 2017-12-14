import { combineReducers } from 'redux'

const initial_feedback_state = {
  dialogOpen:true,
  replyTo: null,
  messages: []
}

const inital_logs_state = {
  logs: [],
  loading: false,
  message: "",
  searchTerm: ""
}

const initial_state = {
    feedback: initial_feedback_state,
    logs: inital_logs_state
}

function feedback(state = initial_feedback_state, action){
  switch (action.type) {
    case 'TOGGLE_DIALOG':
      return {
        ...state,
        dialogOpen: !state.dialogOpen
      }
    case 'REPLY_TO':
      return {
        ...state,
        replyTo: action.replyTo
      }
    case 'FETCH_MESSAGES_RESPONSE':
        return  {
          ...state,
          isLoading: false,
          lastUpdated: Date.now(),
          messages: action.messages
        }
    default:
      return state
  }
}

function logs(state = inital_logs_state, action){
  switch (action.type) {
    case 'FETCH_LOGS_RESPONSE':
      return {
        ...state,
        loading: false,
        lastUpdated: Date.now(),
        logs: action.logs,
        message: `Loaded ${action.logs.length} logs`
      }
    case 'FETCH_LOGS_INIT':
      return{
        ...state,
        loading: true,
        searchTerm: ""
      }
    case 'FETCH_LOGS_ERROR':
      return{
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
      return {...state,loading: true, searchTerm: ""}
    case 'DELETE_LOGS_DONE':
      return {...state,message: "Removed logs from salesforce", loading: false}
    default:
      return state
  }
}

const appReducer = combineReducers({logs, feedback})

export default appReducer

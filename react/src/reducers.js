import {replyTo, toggleDialog, sendMessage} from './actions'
import { combineReducers } from 'redux'

const initial_state = {
    dialogOpen:true,
    replyTo: null,
    messages: []
}

export default function feedback(state = initial_state, action){
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

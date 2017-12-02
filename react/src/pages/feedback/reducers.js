import {replyTo, toggleDialog} from './actions'
import { combineReducers } from 'redux'

const initial_state = {
  dialogState:{
    dialogOpen:true,
    replyTo: null
  },
  messagesState: {
    isLoading: false,
    lastUpdated: null,
    messages: []
  }
}

function dialog(state, action){
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
    default:
      return state
  }
}

function messages(messagesState, action){
  switch (action.type) {
    case 'FETCH_MESSAGES_REQUEST':
      return {
        ...state
      }
    case 'FETCH_MESSAGES_RESPONSE':
      return  {
        ...state
      }
    default:
      return state
  }
}

export default function feedback(state = initial_state, action) {
  return {
    // messagesState: messages(state.messagesState, action),
    dialogState: dialog(state.dialogState, action)}
}

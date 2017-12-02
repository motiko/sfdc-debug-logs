
export function toggleDialog(){
  return {type: 'TOGGLE_DIALOG'}
}

export function replyTo(msg){
  return {type: 'REPLY_TO', replyTo: msg}
}


export function fetchMessagesRequest(){
  return {type: 'FETCH_MESSAGES_REQUEST'}
}

export function fetchMessagesResponse(response){
  return {type: 'FETCH_MESSAGES_RESPONSE',
  messages: response.reverse()}
}

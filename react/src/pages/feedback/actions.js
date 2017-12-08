
const BASE_URL = "https://adbg.herokuapp.com"

export function toggleDialog(){
  return {type: 'TOGGLE_DIALOG'}
}

export function replyTo(msg){
  return {type: 'REPLY_TO', replyTo: msg}
}

export function sendMessage(message){
  return dispatch => {
    const options = {
      method: 'POST',
      body: JSON.stringify(message),
      headers: {
        "Content-Type": "application/json"
      }
    }
    fetch(`${BASE_URL}/messages`, options).then((response) => {
      console.log('THUNK')
      dispatch(toggleDialog())
    })
  }
}




// export function fetchMessagesRequest(){
//   return {type: 'FETCH_MESSAGES_REQUEST'}
// }
//
// export function fetchMessagesResponse(response){
//   return {type: 'FETCH_MESSAGES_RESPONSE',
//   messages: response.reverse()}
// }
//
// export function fetchMessagesError(response){
//   return {type: 'FETCH_MESSAGES_ERROR',
//   eror_message: response}
// }

const BASE_URL = 'https://adbg.herokuapp.com'

export function toggleDialog() {
  return { type: 'TOGGLE_DIALOG' }
}

export function setReplyTo(msg) {
  return { type: 'REPLY_TO', replyTo: msg }
}

export function sendMessage(message, replyToId) {
  return dispatch => {
    const options = {
      method: 'POST',
      body: JSON.stringify(message),
      headers: {
        'Content-Type': 'application/json'
      }
    }
    const afterSent = response => {
      dispatch(loadMessages())
      dispatch(toggleDialog())
      dispatch(setReplyTo(null))
    }
    const endpoint = replyToId
      ? `${BASE_URL}/messages/${replyToId}/reply`
      : `${BASE_URL}/messages/`
    window.fetch(endpoint, options).then(afterSent)
  }
}

export function loadMessages() {
  return dispatch => {
    window
      .fetch(`${BASE_URL}/messages`)
      .then(r => r.json())
      .then(messages => messages.reverse())
      .then(messages => dispatch({ type: 'FETCH_MESSAGES_RESPONSE', messages }))
  }
}

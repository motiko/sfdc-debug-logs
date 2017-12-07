export function logger(store) {
  return function wrap(next) {
    return function dispatchAndLog(action) {
      console.group(action.type)
      console.info('dispatching', action)
      let result = next(action)
      console.log('next state', store.getState())
      console.groupEnd(action.type)
      return result
    }
  }
}

const BASE_URL = "https://adbg.herokuapp.com"
const MESSENGER = 'MESSENGER'

export function messenger(store) {
  return next => action => {
    debugger
    if (action[MESSENGER] === undefined) {
      return next(action)
    }
    const {message, type, replyTo} = action[MESSENGER]
    if (type == 'SEND') {
      const options = {
        method: 'POST',
        body: JSON.stringify(message),
        headers: {
          "Content-Type": "application/json"
        }
      }
      fetch(`${BASE_URL}/messages`, options).then((response) => {
        console.log(response)
        console.log(123)
        next({type: 'TOGGLE_DIALOG'})
      })
    }

  }
}

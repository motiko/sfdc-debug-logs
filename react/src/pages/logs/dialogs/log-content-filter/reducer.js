export const defaultVisibleEvents = []

export function visibleEventsReducer(state = defaultVisibleEvents, action) {
  switch (action.type) {
    case 'ADD_VISIBLE_EVENTS':
      return [...new Set([...state, ...action.newEvents])]
    case 'REMOVE_VISIBLE_EVENT':
      return state.filter(event => event !== action.eventName)
    case 'CLEAR_VISIBLE_EVENTS':
      return []
    default:
      return state
  }
}

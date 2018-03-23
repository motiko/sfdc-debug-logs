export const defaultFiltersState = {
  user: { type: 'text', value: '' },
  operation: { type: 'text', value: '' },
  status: { type: 'text', value: '' },
  length: { type: 'number', value: [0, 2.5 * Math.pow(10, 6)] },
  duration: { type: 'number', value: [0, 2 * 6 * Math.pow(10, 3)] }
}

export function filtersReducer(state = defaultFiltersState, action) {
  switch (action.type) {
    case 'UPDATE_FILTER':
      return {
        ...state,
        [action.filterName]: {
          ...state[action.filterName],
          value: action.newValue
        }
      }
    case 'CLEAR_FILTERS':
      return {
        ...defaultFiltersState
      }
    default:
      return state
  }
}

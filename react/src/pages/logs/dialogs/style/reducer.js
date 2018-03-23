import { defaultLogThemes } from '../../constants'

export const defaultStyleConfig = {
  theme: defaultLogThemes.dark,
  fontSize: 19,
  textWrap: true
}

export function styleConfigReducer(state = defaultStyleConfig, action) {
  switch (action.type) {
    case 'UPDATE_THEME':
      return {
        ...state,
        theme: action.newTheme
      }
    case 'UPDATE_COLOR':
      return {
        ...state,
        theme: {
          ...state.theme,
          [action.propName]: action.newColor
        }
      }
    case 'TOGGLE_TEXT_WRAP':
      return {
        ...state,
        textWrap: !state.textWrap
      }
    case 'UPDATE_FONT_SIZE':
      return {
        ...state,
        fontSize: action.newSize
      }
    default:
      return state
  }
}

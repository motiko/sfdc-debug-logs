export function updateColor(propName, newColor) {
  return { type: 'UPDATE_COLOR', propName, newColor }
}

export function toggleTextWrap() {
  return { type: 'TOGGLE_TEXT_WRAP' }
}

export function updateTheme(newTheme) {
  return { type: 'UPDATE_THEME', newTheme }
}

export function toggleStyleDialog() {
  return { type: 'TOGGLE_STYLE_DIALOG' }
}

export function updateFontSize(newSize) {
  const newSizeNum = parseInt(newSize)
  return { type: 'UPDATE_FONT_SIZE', newSize: newSizeNum }
}

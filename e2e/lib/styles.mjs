// Expected log styles, read from the extension's own theme data
// (react/src/core/log/themes.ts, the single source for both views), so the
// flow checks that every defined theme is actually applied everywhere.
// Node imports the .ts files directly (type stripping); they have no runtime
// imports.

import { logThemes, CLASSIC_CATEGORY_CLASS } from '../../react/src/core/log/themes.ts'

export { logThemes, CLASSIC_CATEGORY_CLASS }
// The app's design tokens (react/src/ui/tokens.ts, also import-free).
export { colors as uiColors } from '../../react/src/ui/tokens.ts'
export { eventCategory, LOG_CATEGORIES } from '../../react/src/core/log/categories.ts'

// '#abc' / '#aabbcc' / '#000' -> 'rgb(r, g, b)' as returned by getComputedStyle.
export function toRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

// A category style of a theme as getComputedStyle reports it:
// { color: 'rgb(…)', 'font-weight': '700', 'font-style': 'italic' }.
export function computedCategoryStyle({ color, fontWeight = 'normal', fontStyle = 'normal' }) {
  return {
    color: toRgb(color),
    'font-weight': { bold: '700', normal: '400' }[fontWeight] || fontWeight,
    'font-style': fontStyle
  }
}

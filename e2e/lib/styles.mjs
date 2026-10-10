// Expected log styles, read from the extension's own sources so the flow
// checks that every defined style is actually applied.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../../scripts/lib/sf-auth.mjs'

export { defaultLogThemes, logEventToType } from '../../react/src/pages/logs/constants.js'

// Parses chrome/app/css/debug.css into
// { monokai: { background: {...}, classes: { debug: { color: '#a6e22e' }, ... } }, ... }
export function classicThemes() {
  const css = readFileSync(join(ROOT, 'chrome/app/css/debug.css'), 'utf8')
  const themes = {}
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decls = Object.fromEntries(
      body
        .split(';')
        .map(d => d.split(':').map(s => s.trim()))
        .filter(([prop, value]) => prop && value)
    )
    for (const selector of selectors.split(',').map(s => s.trim())) {
      let m
      if ((m = selector.match(/^\.(\w+)$/)) && decls['background-color']) {
        themes[m[1]] = themes[m[1]] || { classes: {} }
        themes[m[1]].background = decls['background-color']
      } else if ((m = selector.match(/^\.(\w+) \.(\w+)$/))) {
        themes[m[1]] = themes[m[1]] || { classes: {} }
        themes[m[1]].classes[m[2]] = decls
      }
    }
  }
  return themes
}

// '#abc' / '#aabbcc' / '#000' -> 'rgb(r, g, b)' as returned by getComputedStyle.
export function toRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

// Normalizes an expected CSS value to what getComputedStyle reports.
export function computedValue(prop, value) {
  if (prop === 'color' || prop === 'background-color') return toRgb(value)
  if (prop === 'font-weight') return { bold: '700', normal: '400' }[value] || value
  return value
}

import { describe, expect, it } from 'vitest'
import { colors, designTokensCss, tokenCssVariables } from './tokens'
import { CONTRAST, contrastRatio, formatRatio, luminance } from './contrast'

describe('contrast math', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(luminance('#fff')).toBe(1)
  })

  it('rounds displayed ratios down', () => {
    expect(formatRatio(4.4999)).toBe('4.4:1')
  })
})

// [foreground token, background tokens, minimum ratio]
const RULES: [string, string[], number][] = [
  ['text', ['bg', 'surface', 'surfaceHover', 'selected'], CONTRAST.text],
  ['textMuted', ['bg', 'surface', 'surfaceHover', 'selected'], CONTRAST.text],
  ['accent', ['bg', 'surface', 'surfaceHover', 'selected'], CONTRAST.text],
  ['danger', ['bg', 'surface', 'surfaceHover'], CONTRAST.text],
  ['success', ['bg', 'surface'], CONTRAST.text],
  ['warning', ['bg', 'surface'], CONTRAST.text],
  ['onAccent', ['accent', 'accentHover'], CONTRAST.text],
  ['onDanger', ['danger', 'dangerHover'], CONTRAST.text],
  ['text', ['matchBg', 'currentMatchBg'], CONTRAST.text],
  ['border', ['bg', 'surface', 'surfaceHover'], CONTRAST.nonText],
  ['focus', ['bg', 'surface', 'surfaceHover', 'selected'], CONTRAST.nonText]
]

describe.each(Object.keys(colors))('%s color tokens', mode => {
  const tokens = colors[mode]
  it.each(RULES)('%s on %j meets %d:1', (fg, bgs, min) => {
    const failures = bgs
      .map(bg => [bg, contrastRatio(tokens[fg], tokens[bg])] as const)
      .filter(([, ratio]) => ratio < min)
      .map(([bg, ratio]) => `${fg} on ${bg}: ${ratio.toFixed(2)}`)
    expect(failures).toEqual([])
  })

  it('defines the same tokens as light mode', () => {
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(colors.light).sort())
  })
})

describe('CSS custom properties', () => {
  it('names each token --ad-<kebab-case>', () => {
    const vars = tokenCssVariables('dark')
    expect(vars['--ad-text-muted']).toBe(colors.dark.textMuted)
    expect(vars['--ad-current-match-bg']).toBe(colors.dark.currentMatchBg)
    expect(vars['--ad-font-mono']).toMatch(/monospace$/)
  })

  it('follows the OS and allows forcing a mode', () => {
    const css = designTokensCss('#apex-debugger')
    expect(css).toContain(`#apex-debugger {\n  --ad-bg: ${colors.light.bg};`)
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(
      `#apex-debugger[data-ad-color-mode="dark"] {\n  --ad-bg: ${colors.dark.bg};`
    )
    expect(css).toContain(':focus-visible')
  })
})

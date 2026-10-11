// WCAG 2.2 contrast math, used by the unit tests that check every token and
// log palette, and by the appearance panel to warn about custom colors.
//
// No imports: content scripts and the e2e flow (Node) can use it as is.

// '#abc' or '#aabbcc' -> [r, g, b] (0-255), or null for anything else.
export function parseHex(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim())
  if (!hex) return null
  const digits =
    hex[1].length === 3
      ? [...hex[1]].map(c => c + c).join('')
      : hex[1].toLowerCase()
  return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16)) as [
    number,
    number,
    number
  ]
}

// Relative luminance of an sRGB color (WCAG 2.x definition).
export function luminance(color: string): number {
  const rgb = parseHex(color)
  if (!rgb) throw new Error(`Not a hex color: ${color}`)
  const [r, g, b] = rgb.map(v => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// The contrast ratio of two colors, from 1 to 21.
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The thresholds the design system follows (docs/ux/baseline-review.md,
// "Themes: light and dark").
export const CONTRAST = {
  // Body text, log categories, muted text.
  text: 4.5,
  // Errors and USER_DEBUG lines in the log.
  emphasis: 7,
  // Icons, input borders, focus ring.
  nonText: 3
} as const

// Ratio rounded down to one decimal ("4.4:1"), so a value shown as passing
// really passes.
export function formatRatio(ratio: number): string {
  return `${Math.floor(ratio * 10) / 10}:1`
}

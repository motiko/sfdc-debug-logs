// Design tokens of Apex Debugger: the one source for colors, type, spacing,
// radius and focus across every surface:
//   - the app (html/app.html): ui/theme.ts builds the MUI themes from them;
//   - the options page and the classic Salesforce page enhancements: they can
//     use the same values as CSS custom properties (designTokensCss below),
//     scoped to their own root element.
// Log line colors are separate (core/log/themes.ts), since users can pick and
// edit them.
//
// Contrast rules (checked by tokens.test.ts): text and muted text >= 4.5:1 on
// every background they sit on, icons/input borders/focus ring >= 3:1.
//
// No imports: content scripts and the e2e flow (Node) can import this file.

export type ColorMode = 'light' | 'dark'
// What the user picked: follow the OS (prefers-color-scheme) or force one.
export type ColorModePreference = 'system' | ColorMode

export interface ColorTokens {
  // Page background, behind panels.
  bg: string
  // Panels, header, lists, dialogs.
  surface: string
  // Hovered rows, inputs, secondary buttons.
  surfaceHover: string
  // The selected or current row.
  selected: string
  // Main text and icons.
  text: string
  // Secondary text (timestamps, metadata, hints).
  textMuted: string
  // Dividers between regions (decorative, no contrast requirement).
  divider: string
  // Input and control borders (>= 3:1 on surface).
  border: string
  // Primary actions, links, active states.
  accent: string
  accentHover: string
  // Text and icons on accent.
  onAccent: string
  // Keyboard focus ring (>= 3:1 on bg and surface).
  focus: string
  danger: string
  onDanger: string
  success: string
  warning: string
  // Highlighted search matches (text color stays `text`).
  matchBg: string
  // The current search match.
  currentMatchBg: string
}

export const colors: Record<ColorMode, ColorTokens> = {
  light: {
    bg: '#f6f7f9',
    surface: '#ffffff',
    surfaceHover: '#eef1f4',
    selected: '#dcefed',
    text: '#1b1f24',
    textMuted: '#57606a',
    divider: '#d8dee4',
    border: '#7d8590',
    accent: '#00756a',
    accentHover: '#005f56',
    onAccent: '#ffffff',
    focus: '#0969da',
    danger: '#b42318',
    onDanger: '#ffffff',
    success: '#1a7f37',
    warning: '#8a5a00',
    matchBg: '#fff0a8',
    currentMatchBg: '#ffb84d'
  },
  dark: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#21262d',
    selected: '#173430',
    text: '#e6edf3',
    textMuted: '#9da7b3',
    divider: '#30363d',
    border: '#7d8590',
    accent: '#5cc8bd',
    accentHover: '#7fd6cd',
    onAccent: '#08201d',
    focus: '#58a6ff',
    danger: '#ff8a80',
    onDanger: '#2a0705',
    success: '#56d364',
    warning: '#e3b341',
    matchBg: '#5c4a00',
    currentMatchBg: '#7d4e00'
  }
}

export const fontFamily = {
  ui: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace'
}

// Type scale in px: 12 captions and labels, 13 dense UI and log default,
// 14 body, 16 headings in panels, 20 page titles.
export const fontSize = { xs: 12, sm: 13, md: 14, lg: 16, xl: 20 } as const

export const fontWeight = { regular: 400, medium: 500, semibold: 600 } as const

// 8 px grid (with 4 px half steps).
export const space = (n: number) => n * 8

export const radius = { sm: 4, md: 6, lg: 8 } as const

// Fixed sizes of the app layout.
export const layout = {
  headerHeight: 48,
  rowHeight: 32,
  listWidth: 360,
  listRailWidth: 40
} as const

export const focusRing = {
  width: 2,
  offset: 2
}

// The tokens as CSS custom properties: --ad-<token> (colors in kebab case),
// plus --ad-font-ui, --ad-font-mono, --ad-radius-*, --ad-focus-*.
export function tokenCssVariables(mode: ColorMode): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(colors[mode])) {
    vars[`--ad-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`] = value
  }
  vars['--ad-font-ui'] = fontFamily.ui
  vars['--ad-font-mono'] = fontFamily.mono
  for (const [name, value] of Object.entries(radius)) {
    vars[`--ad-radius-${name}`] = `${value}px`
  }
  vars['--ad-focus-width'] = `${focusRing.width}px`
  vars['--ad-focus-offset'] = `${focusRing.offset}px`
  return vars
}

const block = (selector: string, vars: Record<string, string>) =>
  `${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`

// A stylesheet that defines the tokens on `selector` (e.g. ":root" or a
// content script's own container): light by default, dark when the OS prefers
// it, and either one forced with data-ad-color-mode="light|dark" on the
// element. Insert it as a <style> element's textContent.
export function designTokensCss(selector = ':root'): string {
  const forced = (mode: ColorMode) =>
    `${selector}[data-ad-color-mode="${mode}"]`
  return [
    block(selector, tokenCssVariables('light')),
    `@media (prefers-color-scheme: dark) {\n${block(
      `${selector}:not([data-ad-color-mode="light"])`,
      tokenCssVariables('dark')
    )}\n}`,
    block(forced('light'), tokenCssVariables('light')),
    block(forced('dark'), tokenCssVariables('dark')),
    `${selector} :focus-visible { outline: var(--ad-focus-width) solid var(--ad-focus); outline-offset: var(--ad-focus-offset); }`
  ].join('\n')
}

// Log color palettes ("themes"), defined once for both log views:
//   - the app (pages/logs) colors each line from the palette, with the user's
//     own colors on top (styleConfig.colors, edited in the appearance panel);
//   - the classic log page (extension/debug-log-page.ts) sets the palette's
//     CSS custom properties (themeCssVariables) on #debugText, which the
//     rules in chrome/app/css/debug.css apply to each line's category class.
// The e2e flow (e2e/lib/styles.mjs) reads the same data and checks that every
// palette styles every category in both views.
//
// Contrast rules (themes.test.ts): every category and the muted color at
// least 4.5:1 on the palette's background, errors and USER_DEBUG at least
// 7:1. Errors also get a marker in the app, so color isn't the only cue.
//
// No runtime imports: the e2e flow imports this file directly with Node.
import type { LogCategory } from './categories'

export interface CategoryStyle {
  color: string
  fontWeight?: string
  fontStyle?: string
}

export interface LogTheme {
  name: string
  label: string
  // Which app color mode the palette belongs to (its background's lightness).
  mode: 'light' | 'dark'
  background: string
  // Timestamps, line numbers and other secondary text.
  muted: string
  categories: Record<LogCategory, CategoryStyle>
}

export const logThemes: Record<string, LogTheme> = {
  light: {
    name: 'light',
    label: 'Light',
    mode: 'light',
    background: '#ffffff',
    muted: '#5c6670',
    categories: {
      debug: { color: '#116329', fontWeight: '600' },
      soql: { color: '#7a3fd1' },
      callout: { color: '#8a5a00' },
      system: { color: '#3e5c76' },
      rest: { color: '#24292f' },
      method: { color: '#0550ae' },
      error: { color: '#a40e26', fontWeight: '600' }
    }
  },
  dark: {
    name: 'dark',
    label: 'Dark',
    mode: 'dark',
    background: '#0d1117',
    muted: '#8b949e',
    categories: {
      debug: { color: '#7ee787', fontWeight: '600' },
      soql: { color: '#d2a8ff' },
      callout: { color: '#e3b341' },
      system: { color: '#a5b4c3' },
      rest: { color: '#e6edf3' },
      method: { color: '#79c0ff' },
      error: { color: '#ff8e86', fontWeight: '600' }
    }
  },
  monokai: {
    name: 'monokai',
    label: 'Monokai',
    mode: 'dark',
    background: '#272822',
    muted: '#a8a48c',
    categories: {
      debug: { color: '#a6e22e', fontWeight: '600' },
      soql: { color: '#66d9ef' },
      callout: { color: '#c3a6ff' },
      system: { color: '#b3ae94' },
      rest: { color: '#f8f8f2' },
      method: { color: '#e6db74' },
      error: { color: '#ff9eb0', fontWeight: '600' }
    }
  },
  'high-contrast': {
    name: 'high-contrast',
    label: 'High contrast',
    mode: 'dark',
    background: '#000000',
    muted: '#c8c8c8',
    categories: {
      debug: { color: '#ffe14d', fontWeight: '700' },
      soql: { color: '#7df9ff' },
      callout: { color: '#ffb3ff', fontStyle: 'italic' },
      system: { color: '#d6d6d6' },
      rest: { color: '#ffffff' },
      method: { color: '#a8d8ff' },
      error: { color: '#ff9a9a', fontWeight: '700' }
    }
  }
}

// The app's default: the light or dark palette, matching the app's color
// mode (which follows the OS unless the user picks one).
export const AUTO_THEME = 'auto'

// The classic page's default (it has no color mode yet).
export const DEFAULT_THEME = 'dark'

// Theme names saved by earlier versions. The app called its themes dark and
// light (the colors of monokai and emacs); emacs and bw (black/white) were
// dropped because their colors failed contrast.
export const legacyThemeNames: Record<string, string> = {
  emacs: 'light',
  bw: 'light'
}

// The colors earlier versions shipped, per saved theme name. A saved color
// that still equals its old default wasn't edited by the user, so migration
// replaces it with the new palette's color instead of keeping it.
export const legacyThemeColors: Record<string, Record<string, string>> = {
  monokai: {
    background: '#292724',
    debug: '#a6e22e',
    soql: '#66d9ef',
    callout: '#ae81ff',
    system: '#75715e',
    rest: '#f8f8f2',
    method: '#e6db74',
    error: '#f92672'
  },
  emacs: {
    background: '#ffffcc',
    debug: '#0000ff',
    soql: '#aa22ff',
    callout: '#a0a000',
    system: '#008800',
    rest: '#880000',
    method: '#bb4444',
    error: '#f92672'
  },
  bw: {
    background: '#ffffff',
    debug: '#000000',
    soql: '#000000',
    callout: '#000000',
    system: '#000000',
    rest: '#000000',
    method: '#000000',
    error: '#f92672'
  }
}
// The app saved monokai and emacs as "dark" and "light".
legacyThemeColors.dark = legacyThemeColors.monokai
legacyThemeColors.light = legacyThemeColors.emacs

// The current name for a saved theme name; `fallback` for unknown or missing
// names.
export function resolveThemeName(
  name: string | null | undefined,
  fallback = DEFAULT_THEME
): string {
  if (name && logThemes[name]) return name
  if (name && legacyThemeNames[name]) return legacyThemeNames[name]
  return fallback
}

export function themeByName(name: string | null | undefined): LogTheme {
  return logThemes[resolveThemeName(name)]
}

// The palette the app shows: `name` may be AUTO_THEME, which picks the light
// or dark palette for the app's color mode.
export function paletteFor(
  name: string | null | undefined,
  mode: 'light' | 'dark'
): LogTheme {
  if (!name || name === AUTO_THEME) return logThemes[mode]
  return logThemes[resolveThemeName(name, mode)]
}

// The user's own colors on top of a palette: category -> color, plus
// "background" and "muted".
export type CustomColors = Partial<
  Record<LogCategory | 'background' | 'muted', string>
>

// A palette with the user's colors applied.
export function withCustomColors(
  theme: LogTheme,
  custom: CustomColors | null | undefined
): LogTheme {
  if (!custom) return theme
  const categories = { ...theme.categories }
  for (const category of Object.keys(categories) as LogCategory[]) {
    if (custom[category]) {
      categories[category] = {
        ...categories[category],
        color: custom[category]
      }
    }
  }
  return {
    ...theme,
    background: custom.background || theme.background,
    muted: custom.muted || theme.muted,
    categories
  }
}

// The classic page's class for each category (its markup predates the
// category names; "error" is a common Salesforce page class).
export const CLASSIC_CATEGORY_CLASS: Record<LogCategory, string> = {
  debug: 'debug',
  soql: 'soql',
  callout: 'callout',
  system: 'system',
  rest: 'rest',
  method: 'method',
  error: 'err'
}

// The CSS custom properties that chrome/app/css/debug.css reads:
// --log-background, --log-muted, and --log-<category>-color / -weight /
// -style. The app sets the same properties on its log view.
export function themeCssVariables(theme: LogTheme): Record<string, string> {
  const variables: Record<string, string> = {
    '--log-background': theme.background,
    '--log-muted': theme.muted
  }
  for (const [category, style] of Object.entries(theme.categories)) {
    variables[`--log-${category}-color`] = style.color
    variables[`--log-${category}-weight`] = style.fontWeight || 'normal'
    variables[`--log-${category}-style`] = style.fontStyle || 'normal'
  }
  return variables
}

// Earlier versions saved the app's theme flattened, with every color:
// { themeName, background, debug, soql, … }. Returns the palette name and
// only the colors the user changed from that theme's old defaults.
export function migrateSavedTheme(saved: unknown): {
  theme: string
  colors: CustomColors
} {
  if (!saved || typeof saved !== 'object') {
    return { theme: AUTO_THEME, colors: {} }
  }
  const { themeName, ...savedColors } = saved as Record<string, unknown>
  const name = typeof themeName === 'string' ? themeName : ''
  const theme = name ? resolveThemeName(name, AUTO_THEME) : AUTO_THEME
  const defaults = legacyThemeColors[name] || {}
  const colors: CustomColors = {}
  for (const [key, value] of Object.entries(savedColors)) {
    if (key !== 'background' && !(key in logThemes.light.categories)) continue
    if (typeof value !== 'string' || !value) continue
    if (defaults[key] && defaults[key].toLowerCase() === value.toLowerCase())
      continue
    if (!defaults[key] && logThemes[theme]) {
      // A current palette's own color: not a customization.
      const own =
        key === 'background'
          ? logThemes[theme].background
          : logThemes[theme].categories[key].color
      if (own.toLowerCase() === value.toLowerCase()) continue
    }
    colors[key] = value
  }
  return { theme, colors }
}

// Log color themes, defined once for both log views:
//   - the app (pages/logs) colors each line from the theme's colors, and lets
//     the user change single colors (dialogs/style);
//   - the classic log page (extension/debug-log-page.ts) sets the theme's
//     CSS custom properties (themeCssVariables) on #debugText, which the
//     rules in chrome/app/css/debug.css apply to each line's category class.
// The e2e flow (e2e/lib/styles.mjs) reads the same data and checks that every
// theme styles every category in both views.
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
  background: string
  categories: Record<LogCategory, CategoryStyle>
}

export const logThemes: Record<string, LogTheme> = {
  monokai: {
    name: 'monokai',
    label: 'Monokai (dark)',
    background: '#292724',
    categories: {
      debug: { color: '#a6e22e' },
      soql: { color: '#66d9ef' },
      callout: { color: '#ae81ff' },
      system: { color: '#75715e' },
      rest: { color: '#f8f8f2' },
      method: { color: '#e6db74' },
      error: { color: '#f92672' }
    }
  },
  emacs: {
    name: 'emacs',
    label: 'Emacs (light)',
    background: '#ffffcc',
    categories: {
      debug: { color: '#0000ff', fontWeight: 'bold' },
      soql: { color: '#aa22ff', fontStyle: 'italic' },
      callout: { color: '#a0a000' },
      system: { color: '#008800' },
      rest: { color: '#880000' },
      method: { color: '#bb4444' },
      error: { color: '#f92672' }
    }
  },
  bw: {
    name: 'bw',
    label: 'Black/White',
    background: '#ffffff',
    categories: {
      debug: { color: '#000000', fontWeight: 'bold' },
      soql: { color: '#000000', fontWeight: '600', fontStyle: 'italic' },
      callout: { color: '#000000', fontStyle: 'oblique' },
      system: { color: '#000000' },
      rest: { color: '#000000' },
      method: { color: '#000000' },
      error: { color: '#f92672' }
    }
  }
}

export const DEFAULT_THEME = 'monokai'

// Theme names saved by earlier versions: the app called its themes dark and
// light (same colors as monokai and emacs).
export const legacyThemeNames: Record<string, string> = {
  dark: 'monokai',
  light: 'emacs'
}

// The current name for a saved theme name; the default theme for unknown or
// missing names.
export function resolveThemeName(name: string | null | undefined): string {
  if (name && logThemes[name]) return name
  if (name && legacyThemeNames[name]) return legacyThemeNames[name]
  return DEFAULT_THEME
}

export function themeByName(name: string | null | undefined): LogTheme {
  return logThemes[resolveThemeName(name)]
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
// --log-background, and --log-<category>-color / -weight / -style.
export function themeCssVariables(theme: LogTheme): Record<string, string> {
  const variables: Record<string, string> = {
    '--log-background': theme.background
  }
  for (const [category, style] of Object.entries(theme.categories)) {
    variables[`--log-${category}-color`] = style.color
    variables[`--log-${category}-weight`] = style.fontWeight || 'normal'
    variables[`--log-${category}-style`] = style.fontStyle || 'normal'
  }
  return variables
}

// The app's editable theme (state.logsPage.styleConfig.theme): one color per
// category plus the background, as the style dialog's color pickers edit it.
export type AppTheme = { themeName: string; background: string } & Record<
  LogCategory,
  string
>

export function appTheme(name: string | null | undefined): AppTheme {
  const theme = themeByName(name)
  const colors = Object.fromEntries(
    Object.entries(theme.categories).map(([category, style]) => [
      category,
      style.color
    ])
  ) as Record<LogCategory, string>
  return { themeName: theme.name, ...colors, background: theme.background }
}

// A saved app theme with its name updated (e.g. "dark" -> "monokai"); its
// colors, possibly edited by the user, are kept.
export function migrateAppTheme(
  saved: Partial<AppTheme> | null | undefined
): AppTheme {
  if (!saved || typeof saved !== 'object') return appTheme(DEFAULT_THEME)
  return {
    ...appTheme(saved.themeName),
    ...saved,
    themeName: resolveThemeName(saved.themeName)
  }
}

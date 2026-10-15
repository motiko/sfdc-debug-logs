// The user's log viewer settings, kept in the extension's localStorage (the
// app and the options page share it), so they last across tabs and
// restarts. Up to 0.8.x the app kept them per tab in sessionStorage, as
// redux-localstorage saved them ({ logsPage: { maxLogs, sideLogsOpen,
// styleConfig: { theme: { themeName, …colors }, fontSize, textWrap },
// visibleEvents } }); those are read once and migrated.
import {
  migrateSavedTheme,
  resolveThemeName,
  AUTO_THEME,
  logThemes
} from './core/log/themes'
import { LOG_CATEGORIES, type LogCategory } from './core/log/categories'
import {
  DEFAULT_FONT_SIZE,
  defaultStyleConfig,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  PAGE_SIZE,
  type LogsPageState,
  type StyleConfig
} from './pages/logs/logs-slice'
import { isAutoRefreshInterval } from './pages/logs/auto-refresh'

export const STORAGE_KEY = 'apex-debugger.settings'
// Where 0.8.x saved them (sessionStorage).
export const LEGACY_STORAGE_KEY = 'redux-localstorage'
// 0.8.x's default font size; saved with every style, so it isn't a choice.
const LEGACY_DEFAULT_FONT_SIZE = 19

export const PERSISTED_KEYS = [
  'maxLogs',
  'sideLogsOpen',
  'styleConfig',
  'hiddenCategories',
  'colorMode',
  'autoRefresh'
] as const

type PersistedKey = (typeof PERSISTED_KEYS)[number]
export type Settings = Partial<Pick<LogsPageState, PersistedKey>>

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object'

function cleanStyle(style: Record<string, unknown>): StyleConfig {
  const theme =
    style.theme === AUTO_THEME
      ? AUTO_THEME
      : resolveThemeName(String(style.theme || ''), AUTO_THEME)
  const fontSize = Number(style.fontSize)
  const colors = isObject(style.colors)
    ? Object.fromEntries(
        Object.entries(style.colors).filter(
          ([k, v]) =>
            typeof v === 'string' &&
            (k === 'background' ||
              k === 'muted' ||
              k in logThemes.light.categories)
        )
      )
    : {}
  return {
    theme,
    colors,
    fontSize:
      fontSize >= MIN_FONT_SIZE && fontSize <= MAX_FONT_SIZE
        ? fontSize
        : DEFAULT_FONT_SIZE,
    textWrap:
      typeof style.textWrap === 'boolean'
        ? style.textWrap
        : defaultStyleConfig.textWrap
  }
}

function cleanSettings(saved: Record<string, unknown>): Settings {
  const settings: Settings = {}
  const maxLogs = Math.floor(Number(saved.maxLogs))
  if (maxLogs >= 1) settings.maxLogs = Math.min(maxLogs, 2000)
  if (typeof saved.sideLogsOpen === 'boolean')
    settings.sideLogsOpen = saved.sideLogsOpen
  if (isObject(saved.styleConfig))
    settings.styleConfig = cleanStyle(saved.styleConfig)
  if (Array.isArray(saved.hiddenCategories)) {
    settings.hiddenCategories = saved.hiddenCategories.filter(
      (c): c is LogCategory => (LOG_CATEGORIES as readonly string[]).includes(c)
    )
  }
  if (['system', 'light', 'dark'].includes(saved.colorMode as string)) {
    settings.colorMode = saved.colorMode as Settings['colorMode']
  }
  if (isAutoRefreshInterval(saved.autoRefresh))
    settings.autoRefresh = saved.autoRefresh
  return settings
}

// Settings saved by this version: { version: 2, settings: {…} }.
export function parseSettings(saved: string | null): Settings {
  try {
    const parsed = JSON.parse(saved || 'null')
    return isObject(parsed) && isObject(parsed.settings)
      ? cleanSettings(parsed.settings)
      : {}
  } catch {
    return {}
  }
}

// Settings saved by 0.8.x: the theme keeps only the colors the user changed
// (the palettes were redone for contrast), the old default font size becomes
// the new default, and the event-type filter (visibleEvents) is dropped in
// favor of the category toggles.
export function parseLegacySettings(saved: string | null): Settings {
  let logsPage: unknown
  try {
    logsPage = JSON.parse(saved || '{}').logsPage
  } catch {
    return {}
  }
  if (!isObject(logsPage)) return {}
  const settings: Record<string, unknown> = {
    maxLogs: logsPage.maxLogs,
    sideLogsOpen: logsPage.sideLogsOpen
  }
  if (isObject(logsPage.styleConfig)) {
    const old = logsPage.styleConfig
    const { theme, colors } = migrateSavedTheme(old.theme)
    settings.styleConfig = {
      theme,
      colors,
      fontSize:
        Number(old.fontSize) === LEGACY_DEFAULT_FONT_SIZE
          ? DEFAULT_FONT_SIZE
          : old.fontSize,
      textWrap: old.textWrap
    }
  }
  return cleanSettings(settings)
}

export function serializeSettings(state: LogsPageState): string {
  const settings = Object.fromEntries(PERSISTED_KEYS.map(k => [k, state[k]]))
  return JSON.stringify({ version: 2, settings })
}

// Storage can be unavailable (e.g. blocked site data); settings then last
// only as long as the page.
export function loadSettings(
  storage: Storage,
  legacyStorage?: Storage
): Settings {
  try {
    const saved = storage.getItem(STORAGE_KEY)
    if (saved) return parseSettings(saved)
    const legacy = legacyStorage && legacyStorage.getItem(LEGACY_STORAGE_KEY)
    return legacy ? parseLegacySettings(legacy) : {}
  } catch {
    return {}
  }
}

export function saveSettings(storage: Storage, state: LogsPageState): void {
  try {
    storage.setItem(STORAGE_KEY, serializeSettings(state))
  } catch {
    // See loadSettings.
  }
}

// Whether any persisted setting changed between two states.
export function settingsChanged(a: LogsPageState, b: LogsPageState): boolean {
  return PERSISTED_KEYS.some(key => a[key] !== b[key])
}

export { PAGE_SIZE }

// The user's log viewer settings, kept in sessionStorage so they survive a
// reload of the app tab. Earlier versions saved them with redux-localstorage;
// the key and the shape ({ logsPage: { maxLogs, … } } as JSON) are the same,
// so saved settings keep working.
import { migrateAppTheme } from './core/log/themes'
import { defaultStyleConfig, type LogsPageState } from './pages/logs/logs-slice'

export const STORAGE_KEY = 'redux-localstorage'

export const PERSISTED_KEYS = [
  'maxLogs',
  'sideLogsOpen',
  'styleConfig',
  'visibleEvents'
] as const

type PersistedKey = (typeof PERSISTED_KEYS)[number]
export type Settings = Partial<Pick<LogsPageState, PersistedKey>>

// The saved settings, ready to merge into the initial logsPage state. A theme
// saved under an old name keeps its colors under its current name (e.g.
// "dark" -> "monokai"); a style saved without some setting gets its default.
export function parseSettings(saved: string | null): Settings {
  let logsPage: Record<string, unknown>
  try {
    logsPage = JSON.parse(saved || '{}').logsPage
  } catch {
    return {}
  }
  if (!logsPage || typeof logsPage !== 'object') return {}
  const settings: Settings = {}
  for (const key of PERSISTED_KEYS) {
    if (key in logsPage) settings[key] = logsPage[key] as never
  }
  if (settings.styleConfig && typeof settings.styleConfig === 'object') {
    settings.styleConfig = {
      ...defaultStyleConfig,
      ...settings.styleConfig,
      theme: migrateAppTheme(settings.styleConfig.theme)
    }
  } else {
    delete settings.styleConfig
  }
  if (!Array.isArray(settings.visibleEvents)) delete settings.visibleEvents
  return settings
}

export function serializeSettings(state: LogsPageState): string {
  const logsPage = Object.fromEntries(PERSISTED_KEYS.map(k => [k, state[k]]))
  return JSON.stringify({ logsPage })
}

// Storage can be unavailable (e.g. blocked site data); settings then last
// only as long as the page.
export function loadSettings(storage: Storage): Settings {
  try {
    return parseSettings(storage.getItem(STORAGE_KEY))
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

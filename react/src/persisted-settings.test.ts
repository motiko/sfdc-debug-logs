import { describe, it, expect } from 'vitest'
import {
  LEGACY_STORAGE_KEY,
  loadSettings,
  parseLegacySettings,
  parseSettings,
  serializeSettings,
  settingsChanged,
  STORAGE_KEY
} from './persisted-settings'
import reducer, {
  initialLogsPageState,
  showToast,
  toggleSideLogs,
  setTheme
} from './pages/logs/logs-slice'
import { legacyThemeColors } from './core/log/themes'

// A theme as 0.8.x saved it: flattened, with every color.
const oldTheme = (name: string, colors: Record<string, string> = {}) => ({
  themeName: name,
  ...legacyThemeColors[name],
  ...colors
})

function memoryStorage(items: Record<string, string> = {}): Storage {
  return {
    getItem: (k: string) => (k in items ? items[k] : null),
    setItem: (k: string, v: string) => void (items[k] = v),
    removeItem: (k: string) => void delete items[k],
    clear: () => {},
    key: () => null,
    length: 0
  }
}

describe('settings saved by 0.8.x (redux-localstorage in sessionStorage)', () => {
  it('keeps the list settings and the edited colors, with the new palette', () => {
    const saved = JSON.stringify({
      logsPage: {
        maxLogs: '20',
        sideLogsOpen: false,
        styleConfig: {
          theme: oldTheme('emacs', { debug: '#123456' }),
          fontSize: 14,
          textWrap: false
        },
        visibleEvents: ['USER_DEBUG']
      }
    })
    expect(parseLegacySettings(saved)).toEqual({
      maxLogs: 20,
      sideLogsOpen: false,
      styleConfig: {
        theme: 'light',
        colors: { debug: '#123456' },
        fontSize: 14,
        textWrap: false
      }
    })
  })

  it('maps old theme names and the old default font size', () => {
    const saved = JSON.stringify({
      logsPage: {
        styleConfig: { theme: oldTheme('dark', { soql: '#abc' }), fontSize: 19 }
      }
    })
    expect(parseLegacySettings(saved).styleConfig).toEqual({
      theme: 'dark',
      colors: { soql: '#abc' },
      fontSize: 13,
      textWrap: true
    })
    const monokai = JSON.stringify({
      logsPage: { styleConfig: { theme: oldTheme('monokai') } }
    })
    expect(parseLegacySettings(monokai).styleConfig).toMatchObject({
      theme: 'monokai',
      colors: {}
    })
  })

  it('ignores missing, broken or foreign data', () => {
    expect(parseLegacySettings(null)).toEqual({})
    expect(parseLegacySettings('not json')).toEqual({})
    expect(parseLegacySettings('{"other":1}')).toEqual({})
    expect(
      parseLegacySettings('{"logsPage":{"visibleEvents":"x","maxLogs":"x"}}')
    ).toEqual({})
  })

  it('is read only when there are no current settings', () => {
    const legacy = memoryStorage({
      [LEGACY_STORAGE_KEY]: JSON.stringify({
        logsPage: { sideLogsOpen: false }
      })
    })
    expect(loadSettings(memoryStorage(), legacy)).toEqual({
      sideLogsOpen: false
    })
    const current = memoryStorage({
      [STORAGE_KEY]: serializeSettings(initialLogsPageState)
    })
    expect(loadSettings(current, legacy).sideLogsOpen).toBe(true)
  })
})

describe('current settings', () => {
  it('round-trips the persisted keys only', () => {
    const state = reducer(
      { ...initialLogsPageState, logBodies: { a: 'big' } },
      setTheme('monokai')
    )
    const saved = JSON.parse(serializeSettings(state))
    expect(saved.version).toBe(2)
    expect(Object.keys(saved.settings).sort()).toEqual([
      'colorMode',
      'hiddenCategories',
      'maxLogs',
      'sideLogsOpen',
      'styleConfig'
    ])
    expect(parseSettings(serializeSettings(state))).toEqual({
      maxLogs: state.maxLogs,
      sideLogsOpen: state.sideLogsOpen,
      styleConfig: state.styleConfig,
      hiddenCategories: [],
      colorMode: 'system'
    })
  })

  it('drops invalid values', () => {
    const saved = JSON.stringify({
      version: 2,
      settings: {
        maxLogs: -3,
        colorMode: 'purple',
        hiddenCategories: ['debug', 'nope'],
        styleConfig: {
          theme: 'solarized',
          fontSize: 99,
          colors: { debug: '#123', evil: 'x' }
        }
      }
    })
    expect(parseSettings(saved)).toEqual({
      hiddenCategories: ['debug'],
      styleConfig: {
        theme: 'auto',
        colors: { debug: '#123' },
        fontSize: 13,
        textWrap: true
      }
    })
    expect(parseSettings('nope')).toEqual({})
  })

  it('notices changes to persisted keys only', () => {
    const state = initialLogsPageState
    expect(settingsChanged(state, reducer(state, showToast('hi')))).toBe(false)
    expect(settingsChanged(state, reducer(state, toggleSideLogs()))).toBe(true)
  })
})

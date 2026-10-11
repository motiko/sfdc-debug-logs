import { describe, it, expect } from 'vitest'
import {
  parseSettings,
  serializeSettings,
  settingsChanged,
  STORAGE_KEY
} from './persisted-settings'
import reducer, {
  initialLogsPageState,
  toggleSideLogs,
  setMessage
} from './pages/logs/logs-slice'
import { appTheme } from './core/log/themes'

describe('persisted settings', () => {
  it('keeps the storage key of earlier versions (redux-localstorage)', () => {
    expect(STORAGE_KEY).toBe('redux-localstorage')
  })

  it('reads settings saved by redux-localstorage', () => {
    // What 0.8.x saved: the filtered state as JSON.
    const saved = JSON.stringify({
      logsPage: {
        maxLogs: '20',
        sideLogsOpen: false,
        styleConfig: {
          theme: { ...appTheme('emacs'), debug: '#123456' },
          fontSize: 14,
          textWrap: false
        },
        visibleEvents: ['USER_DEBUG']
      }
    })
    expect(parseSettings(saved)).toEqual({
      maxLogs: '20',
      sideLogsOpen: false,
      styleConfig: {
        theme: { ...appTheme('emacs'), debug: '#123456' },
        fontSize: 14,
        textWrap: false
      },
      visibleEvents: ['USER_DEBUG']
    })
  })

  it('renames old theme names and keeps the edited colors', () => {
    const saved = JSON.stringify({
      logsPage: {
        styleConfig: {
          theme: { ...appTheme('monokai'), themeName: 'dark', soql: '#abc' },
          fontSize: 12
        }
      }
    })
    const { styleConfig } = parseSettings(saved)
    expect(styleConfig.theme.themeName).toBe('monokai')
    expect(styleConfig.theme.soql).toBe('#abc')
    // Missing settings get their defaults.
    expect(styleConfig.textWrap).toBe(true)
    expect(styleConfig.fontSize).toBe(12)
  })

  it('ignores missing, broken or foreign data', () => {
    expect(parseSettings(null)).toEqual({})
    expect(parseSettings('not json')).toEqual({})
    expect(parseSettings('{"other":1}')).toEqual({})
    expect(
      parseSettings('{"logsPage":{"visibleEvents":"x","filters":{}}}')
    ).toEqual({})
  })

  it('saves only the persisted keys, in the same shape', () => {
    const state = { ...initialLogsPageState, logBodies: { a: 'big' } }
    const saved = JSON.parse(serializeSettings(state))
    expect(Object.keys(saved)).toEqual(['logsPage'])
    expect(Object.keys(saved.logsPage).sort()).toEqual([
      'maxLogs',
      'sideLogsOpen',
      'styleConfig',
      'visibleEvents'
    ])
    expect(parseSettings(serializeSettings(state))).toEqual({
      maxLogs: state.maxLogs,
      sideLogsOpen: state.sideLogsOpen,
      styleConfig: state.styleConfig,
      visibleEvents: state.visibleEvents
    })
  })

  it('notices changes to persisted keys only', () => {
    const state = initialLogsPageState
    expect(settingsChanged(state, reducer(state, setMessage('hi')))).toBe(false)
    expect(settingsChanged(state, reducer(state, toggleSideLogs()))).toBe(true)
  })
})

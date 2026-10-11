import { describe, expect, it } from 'vitest'
import debugCss from '../../../../chrome/app/css/debug.css?raw'
import { LOG_CATEGORIES } from './categories'
import {
  appTheme,
  CLASSIC_CATEGORY_CLASS,
  DEFAULT_THEME,
  logThemes,
  migrateAppTheme,
  resolveThemeName,
  themeByName,
  themeCssVariables
} from './themes'

describe('logThemes', () => {
  it.each(Object.entries(logThemes))(
    '%s defines a color for every category and a background',
    (name, theme) => {
      expect(theme.name).toBe(name)
      expect(theme.label).toBeTruthy()
      expect(theme.background).toMatch(/^#[0-9a-f]{6}$/)
      expect(Object.keys(theme.categories).sort()).toEqual(
        [...LOG_CATEGORIES].sort()
      )
      for (const style of Object.values(theme.categories)) {
        expect(style.color).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  )

  it('has unique labels (the app menu shows them)', () => {
    const labels = Object.values(logThemes).map(t => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('resolveThemeName', () => {
  it('keeps current names', () => {
    for (const name of Object.keys(logThemes)) {
      expect(resolveThemeName(name)).toBe(name)
    }
  })

  it("maps the app's old names to the theme with their colors", () => {
    expect(resolveThemeName('dark')).toBe('monokai')
    expect(resolveThemeName('light')).toBe('emacs')
    expect(appTheme('dark').debug).toBe('#a6e22e')
    expect(appTheme('light').background).toBe('#ffffcc')
  })

  it('falls back to the default theme', () => {
    expect(resolveThemeName(null)).toBe(DEFAULT_THEME)
    expect(resolveThemeName('solarized')).toBe(DEFAULT_THEME)
    expect(themeByName(undefined)).toBe(logThemes[DEFAULT_THEME])
  })
})

describe('appTheme', () => {
  it('flattens a theme to one color per category, as the color pickers edit it', () => {
    expect(appTheme('monokai')).toEqual({
      themeName: 'monokai',
      debug: '#a6e22e',
      soql: '#66d9ef',
      callout: '#ae81ff',
      system: '#75715e',
      rest: '#f8f8f2',
      method: '#e6db74',
      error: '#f92672',
      background: '#292724'
    })
  })
})

describe('migrateAppTheme', () => {
  it('renames a saved legacy theme and keeps edited colors', () => {
    const saved = { ...appTheme('light'), themeName: 'light', debug: '#123456' }
    expect(migrateAppTheme(saved)).toEqual({
      ...appTheme('emacs'),
      debug: '#123456'
    })
  })

  it('fills in a missing theme', () => {
    expect(migrateAppTheme(undefined)).toEqual(appTheme(DEFAULT_THEME))
  })
})

describe('classic page styles', () => {
  it('sets a variable for the background and each category style', () => {
    const variables = themeCssVariables(logThemes.emacs)
    expect(variables['--log-background']).toBe('#ffffcc')
    expect(variables['--log-debug-weight']).toBe('bold')
    expect(variables['--log-soql-style']).toBe('italic')
    expect(variables['--log-rest-weight']).toBe('normal')
    expect(Object.keys(variables)).toHaveLength(1 + 3 * LOG_CATEGORIES.length)
  })

  it.each(LOG_CATEGORIES.map(c => [c, CLASSIC_CATEGORY_CLASS[c]]))(
    'debug.css styles %s (.%s) from the variables',
    (category, className) => {
      const rule = debugCss.match(
        new RegExp(
          `#debugText \\.${className},#debugText \\.${className} a \\{([^}]*)\\}`
        )
      )
      expect(rule).not.toBeNull()
      expect(rule[1]).toContain(`color: var(--log-${category}-color)`)
      expect(rule[1]).toContain(`font-weight: var(--log-${category}-weight)`)
      expect(rule[1]).toContain(`font-style: var(--log-${category}-style)`)
    }
  )

  it('debug.css sets the background from the variable', () => {
    expect(debugCss).toContain(
      '#debugText { background-color: var(--log-background) }'
    )
  })
})

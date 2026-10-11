import { describe, expect, it } from 'vitest'
import debugCss from '../../../../chrome/app/css/debug.css?raw'
import { LOG_CATEGORIES } from './categories'
import {
  AUTO_THEME,
  CLASSIC_CATEGORY_CLASS,
  DEFAULT_THEME,
  legacyThemeColors,
  logThemes,
  migrateSavedTheme,
  paletteFor,
  resolveThemeName,
  themeByName,
  themeCssVariables,
  withCustomColors
} from './themes'
import { CONTRAST, contrastRatio } from '../../ui/contrast'

const palettes = Object.entries(logThemes)

describe('logThemes', () => {
  it.each(palettes)(
    '%s defines a color for every category, a background and a muted color',
    (name, theme) => {
      expect(theme.name).toBe(name)
      expect(theme.label).toBeTruthy()
      expect(theme.background).toMatch(/^#[0-9a-f]{6}$/)
      expect(theme.muted).toMatch(/^#[0-9a-f]{6}$/)
      expect(Object.keys(theme.categories).sort()).toEqual(
        [...LOG_CATEGORIES].sort()
      )
      for (const style of Object.values(theme.categories)) {
        expect(style.color).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  )

  it('has unique labels (the menus show them)', () => {
    const labels = Object.values(logThemes).map(t => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('has a light and a dark palette for the app color modes', () => {
    expect(logThemes.light.mode).toBe('light')
    expect(logThemes.dark.mode).toBe('dark')
  })
})

// Contrast of every palette's text colors on its background
// (docs/ux/baseline-review.md M2): 4.5:1 for every category and the muted
// color, 7:1 for errors and USER_DEBUG.
describe.each(palettes)('%s palette contrast', (name, theme) => {
  const minimum = (category: string) =>
    category === 'error' || category === 'debug'
      ? CONTRAST.emphasis
      : CONTRAST.text

  it.each(LOG_CATEGORIES)(
    '%s meets its minimum on the background',
    category => {
      const ratio = contrastRatio(
        theme.categories[category].color,
        theme.background
      )
      expect(
        ratio,
        `${name} ${category} ${theme.categories[category].color} on ${theme.background}: ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(minimum(category))
    }
  )

  it('muted text meets 4.5:1', () => {
    expect(contrastRatio(theme.muted, theme.background)).toBeGreaterThanOrEqual(
      CONTRAST.text
    )
  })

  it("the palette's mode matches its background", () => {
    const light = contrastRatio(theme.background, '#000000') > 10
    expect(theme.mode).toBe(light ? 'light' : 'dark')
  })
})

describe('resolveThemeName', () => {
  it('keeps current names', () => {
    for (const name of Object.keys(logThemes)) {
      expect(resolveThemeName(name)).toBe(name)
    }
  })

  it('maps dropped themes to the light palette', () => {
    expect(resolveThemeName('emacs')).toBe('light')
    expect(resolveThemeName('bw')).toBe('light')
  })

  it('falls back to the default theme', () => {
    expect(resolveThemeName(null)).toBe(DEFAULT_THEME)
    expect(resolveThemeName('solarized')).toBe(DEFAULT_THEME)
    expect(themeByName(undefined)).toBe(logThemes[DEFAULT_THEME])
  })
})

describe('paletteFor', () => {
  it('follows the color mode for the automatic palette', () => {
    expect(paletteFor(AUTO_THEME, 'light')).toBe(logThemes.light)
    expect(paletteFor(AUTO_THEME, 'dark')).toBe(logThemes.dark)
    expect(paletteFor(undefined, 'dark')).toBe(logThemes.dark)
  })

  it('keeps a picked palette in either mode', () => {
    expect(paletteFor('monokai', 'light')).toBe(logThemes.monokai)
    expect(paletteFor('emacs', 'dark')).toBe(logThemes.light)
  })
})

describe('withCustomColors', () => {
  it("replaces only the user's colors and keeps fonts", () => {
    const theme = withCustomColors(logThemes.light, {
      debug: '#123456',
      background: '#fafafa'
    })
    expect(theme.categories.debug).toEqual({
      color: '#123456',
      fontWeight: '600'
    })
    expect(theme.categories.soql).toBe(logThemes.light.categories.soql)
    expect(theme.background).toBe('#fafafa')
    expect(withCustomColors(logThemes.dark, null)).toBe(logThemes.dark)
  })
})

describe('migrateSavedTheme', () => {
  // The app saved its theme flattened, with every color.
  const saved = (name: string, colors: Record<string, string> = {}) => ({
    themeName: name,
    ...legacyThemeColors[name],
    ...colors
  })

  it('keeps a palette that still exists and drops unedited old colors', () => {
    expect(migrateSavedTheme(saved('monokai'))).toEqual({
      theme: 'monokai',
      colors: {}
    })
  })

  it('maps the old "dark" and "light" names', () => {
    expect(migrateSavedTheme(saved('dark')).theme).toBe('dark')
    expect(migrateSavedTheme(saved('light')).theme).toBe('light')
    expect(migrateSavedTheme(saved('emacs')).theme).toBe('light')
    expect(migrateSavedTheme(saved('bw')).theme).toBe('light')
  })

  it('keeps the colors the user edited', () => {
    expect(
      migrateSavedTheme(saved('dark', { debug: '#123456', background: '#000' }))
    ).toEqual({
      theme: 'dark',
      colors: { debug: '#123456', background: '#000' }
    })
  })

  it('ignores unknown keys and missing themes', () => {
    expect(migrateSavedTheme({ themeName: 'bw', foo: '#fff' })).toEqual({
      theme: 'light',
      colors: {}
    })
    expect(migrateSavedTheme(undefined)).toEqual({
      theme: AUTO_THEME,
      colors: {}
    })
    expect(migrateSavedTheme({ themeName: 'solarized' }).theme).toBe(AUTO_THEME)
  })
})

describe('classic page styles', () => {
  it('sets a variable for the background, muted text and each category style', () => {
    const variables = themeCssVariables(logThemes['high-contrast'])
    expect(variables['--log-background']).toBe('#000000')
    expect(variables['--log-debug-weight']).toBe('700')
    expect(variables['--log-callout-style']).toBe('italic')
    expect(variables['--log-rest-weight']).toBe('normal')
    expect(Object.keys(variables)).toHaveLength(2 + 3 * LOG_CATEGORIES.length)
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

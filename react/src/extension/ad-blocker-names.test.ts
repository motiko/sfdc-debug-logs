// Ad blockers' generic filters (EasyList: ##.ad-root, ##.ad-button, …) hide
// matching elements on every site, Salesforce included: v0.9.0 named its
// classes ad-*, and Adblock Plus hid the classic log page. Names the
// extension puts on Salesforce pages must not look like ad names. CSS custom
// properties (--ad-*) are not selectors, so they may keep the prefix.
import { describe, expect, it } from 'vitest'

// Everything the content scripts and their styles are built from.
const sources: Record<string, string> = import.meta.glob(
  [
    '../extension/**/*.ts',
    '../core/**/*.ts',
    '../ui/**/*.{ts,js}',
    '../../../chrome/app/css/*.css',
    '!**/*.test.*'
  ],
  { query: '?raw', import: 'default', eager: true }
)

// ad-x, ad_x, adX and data-ad-x, but not --ad-x or words like "add".
const adLikeName = /(?<![\w-])(?:data-)?ad(?:[-_][a-z]|[A-Z]\w)\w*/g

describe('names on Salesforce pages', () => {
  it('finds the sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    // CSS comes as text, not as Vitest's empty module (vite.config.mjs).
    expect(sources['../../../chrome/app/css/classic.css']).toContain(
      '.apexdbg-root'
    )
  })

  it.each(Object.entries(sources))(
    '%s has no class, id or data attribute an ad blocker hides',
    (_, source) => {
      expect(source.match(adLikeName) || []).toEqual([])
    }
  )
})

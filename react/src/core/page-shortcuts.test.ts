import { describe, it, expect } from 'vitest'
import {
  activeShortcuts,
  bindingsFor,
  DEFAULT_PAGE_SHORTCUTS,
  defaultPageShortcutSettings,
  LEGACY_SHORTCUTS_STORAGE_KEY,
  loadPageShortcuts,
  migrateLegacyShortcuts,
  parsePageShortcutSettings,
  SHORTCUTS_STORAGE_KEY,
  validateShortcuts,
  type PageShortcut
} from './page-shortcuts'

// 0.8.x's defaults, as it saved them in chrome.storage.sync "shortcuts".
const LEGACY_DEFAULTS = [
  { name: 'Apex Debugger', key: 'w', app: true },
  { name: 'Debug Logs', key: 'd', path: '/setup/ui/listApexTraces.apexp' },
  {
    name: 'Custom Objects',
    key: 'o',
    path: '/p/setup/custent/CustomObjectsPage'
  },
  { name: 'Manage Users', key: 'u', path: '/005?setupid=ManageUsers' },
  { name: 'Profiles', key: 'p', path: '/00e?setupid=EnhancedProfiles' },
  {
    name: 'Schema Builder',
    key: 's',
    path: '/_ui/platform/schema/ui/schemabuilder/SchemaBuilderUi?setupid=SchemaBuilder'
  }
]

const combos = (shortcuts: PageShortcut[]) =>
  shortcuts.flatMap(s => bindingsFor(s).map(b => b.combo))

describe('the default page shortcuts', () => {
  it('have no conflicts and no bare letters', () => {
    const settings = defaultPageShortcutSettings()
    expect(validateShortcuts(settings.shortcuts)).toEqual([])
    for (const combo of combos(settings.shortcuts)) {
      expect(combo).toMatch(/^(shift|alt\+shift|mod)\+[a-z]$/)
    }
  })

  it('keep Shift+W for the app, and Save needs Ctrl/Cmd', () => {
    const settings = defaultPageShortcutSettings()
    const app = settings.shortcuts.find(s => s.action === 'openApp')
    expect(bindingsFor(app).map(b => b.combo)).toContain('shift+w')
    const save = settings.shortcuts.find(s => s.action === 'save')
    expect(bindingsFor(save)).toEqual([
      { combo: 'mod+s', keys: 'Mod+s', effect: 'run' }
    ])
    const edit = settings.shortcuts.find(s => s.action === 'edit')
    expect(bindingsFor(edit).map(b => b.combo)).toEqual(['shift+e'])
  })

  it('turned off: only the app shortcut stays', () => {
    const settings = { ...defaultPageShortcutSettings(), enabled: false }
    expect(activeShortcuts(settings).map(s => s.id)).toEqual(['app'])
  })

  it('a shortcut without a key is off', () => {
    const settings = defaultPageShortcutSettings()
    settings.shortcuts.find(s => s.id === 'edit').key = ''
    expect(activeShortcuts(settings).some(s => s.id === 'edit')).toBe(false)
    expect(validateShortcuts(settings.shortcuts)).toEqual([])
  })
})

describe('validateShortcuts', () => {
  it('reports two shortcuts on the same combination', () => {
    const shortcuts: PageShortcut[] = [
      { id: 'a', name: 'Accounts', key: 'a', path: '/001' },
      { id: 'b', name: 'Assets', key: 'a', path: '/02i' }
    ]
    expect(validateShortcuts(shortcuts)).toEqual([
      {
        id: 'b',
        field: 'key',
        message: 'Shift+A is also used by “Accounts”.'
      }
    ])
  })

  it('Save on Ctrl+S and a navigation on Shift+S do not conflict', () => {
    const shortcuts = DEFAULT_PAGE_SHORTCUTS.filter(
      s => s.id === 'save' || s.id === 'schema-builder'
    )
    expect(validateShortcuts(shortcuts)).toEqual([])
  })

  it('reports invalid keys, missing paths and browser shortcuts', () => {
    const problems = validateShortcuts([
      { id: 'x', name: 'X', key: '1', path: '/001' },
      { id: 'y', name: 'Y', key: 'y', path: ' ' },
      { id: 'z', name: 'Save', key: 't', action: 'save' },
      { id: 'q', name: 'Q', key: 'q', path: "/a'b" }
    ])
    expect(problems.map(p => [p.id, p.field])).toEqual([
      ['x', 'key'],
      ['y', 'path'],
      ['z', 'key'],
      ['q', 'path']
    ])
  })
})

describe('migrating 0.8.x shortcuts', () => {
  it('no saved shortcuts: the defaults', () => {
    expect(migrateLegacyShortcuts(undefined)).toEqual(
      defaultPageShortcutSettings()
    )
  })

  it('keeps custom shortcuts, changed keys and removed defaults', () => {
    const legacy = [
      ...LEGACY_DEFAULTS.filter(s => s.name !== 'Profiles'),
      { name: 'Accounts', key: 'a', path: '001' },
      { name: 'Token', token: true, path: 'secret' }
    ]
    legacy[1] = { ...legacy[1], key: 'g' } // Debug Logs on G
    const migrated = migrateLegacyShortcuts(legacy)
    const byName = Object.fromEntries(migrated.shortcuts.map(s => [s.name, s]))
    expect(byName['Debug Logs']).toMatchObject({ id: 'debug-logs', key: 'g' })
    expect(byName.Accounts).toMatchObject({ key: 'a', path: '/001' })
    expect(byName.Accounts.id).toMatch(/^custom-/)
    expect(byName.Profiles).toBeUndefined()
    expect(migrated.shortcuts.some(s => s.name === 'Token')).toBe(false)
    expect(migrated.enabled).toBe(true)
    expect(validateShortcuts(migrated.shortcuts)).toEqual([])
  })

  it('adds Edit, Save and the newest log, with modifiers', () => {
    const migrated = migrateLegacyShortcuts(LEGACY_DEFAULTS)
    const ids = migrated.shortcuts.map(s => s.id)
    expect(ids.slice(0, 4)).toEqual(['app', 'last-log', 'edit', 'save'])
    expect(combos(migrated.shortcuts)).toContain('mod+s')
    expect(combos(migrated.shortcuts)).toContain('shift+e')
    expect(combos(migrated.shortcuts)).toContain('shift+l')
  })

  it("a user's shortcut keeps its key; the built-in that would clash is off", () => {
    const migrated = migrateLegacyShortcuts([
      ...LEGACY_DEFAULTS,
      { name: 'Leads', key: 'l', path: '/00Q' },
      { name: 'Events', key: 'e', path: '/00U' }
    ])
    const byId = Object.fromEntries(migrated.shortcuts.map(s => [s.id, s]))
    expect(byId['last-log'].key).toBe('')
    expect(byId.edit.key).toBe('')
    expect(migrated.shortcuts.find(s => s.name === 'Leads').key).toBe('l')
    expect(validateShortcuts(migrated.shortcuts)).toEqual([])
  })

  it('keeps a changed key for the app', () => {
    const migrated = migrateLegacyShortcuts([
      { name: 'Apex Debugger', key: 'x', app: true }
    ])
    expect(migrated.shortcuts[0]).toMatchObject({ action: 'openApp', key: 'x' })
  })
})

describe('parsePageShortcutSettings', () => {
  it('reads what this version saves', () => {
    const settings = defaultPageShortcutSettings()
    settings.enabled = false
    expect(
      parsePageShortcutSettings(JSON.parse(JSON.stringify(settings)))
    ).toEqual(settings)
  })

  it('drops broken entries and always keeps the app shortcut', () => {
    const parsed = parsePageShortcutSettings({
      version: 2,
      shortcuts: [
        { id: 'a', name: 'A', key: 'A', path: '001' },
        { id: 'a', name: 'dup', key: 'b', path: '/x' },
        { name: 'no id', key: 'c', path: '/y' },
        { id: 'b', name: 'nothing to do', key: 'b' },
        'junk'
      ]
    })
    expect(parsed.shortcuts).toEqual([
      DEFAULT_PAGE_SHORTCUTS[0],
      { id: 'a', name: 'A', key: 'a', path: '/001' }
    ])
    expect(parsed.enabled).toBe(true)
  })

  it('anything else is not saved settings', () => {
    expect(parsePageShortcutSettings(undefined)).toBe(null)
    expect(parsePageShortcutSettings([{ key: 'a' }])).toBe(null)
  })
})

describe('loadPageShortcuts', () => {
  const area = (items: Record<string, unknown>) => ({
    get: async (keys: string[]) =>
      Object.fromEntries(keys.filter(k => k in items).map(k => [k, items[k]]))
  })

  it('prefers the saved settings over the 0.8.x list', async () => {
    const saved = { ...defaultPageShortcutSettings(), enabled: false }
    const settings = await loadPageShortcuts(
      area({
        [SHORTCUTS_STORAGE_KEY]: saved,
        [LEGACY_SHORTCUTS_STORAGE_KEY]: LEGACY_DEFAULTS
      })
    )
    expect(settings.enabled).toBe(false)
  })

  it('migrates the 0.8.x list when nothing else is saved', async () => {
    const settings = await loadPageShortcuts(
      area({ [LEGACY_SHORTCUTS_STORAGE_KEY]: LEGACY_DEFAULTS })
    )
    expect(settings.shortcuts.find(s => s.id === 'profiles').key).toBe('p')
    expect(settings.shortcuts.some(s => s.id === 'classes')).toBe(false)
  })
})

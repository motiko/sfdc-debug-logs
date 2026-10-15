// Keyboard shortcuts on Salesforce pages, as data: the one registry that
//   - extension/shortcuts.ts binds on every Salesforce page,
//   - extension/debug-log-page.ts and debug-log-list.ts bind for their page
//     (CLASSIC_LOG_PAGE_SHORTCUTS, CLASSIC_LOG_LIST_SHORTCUTS),
//   - the options page edits (Keyboard shortcuts),
//   - the app's "?" overlay lists.
// The app's own shortcuts are in app-shortcuts.ts.
//
// Rules (docs/ux/baseline-review.md M15): no bare letter changes data
// (Save is Ctrl/Cmd+S, Edit is Shift+E; the classic list has no delete key),
// the page shortcuts can be turned off, and the options page reports
// conflicts.
//
// The user's shortcuts are saved in chrome.storage.sync under
// SHORTCUTS_STORAGE_KEY. Versions up to 0.8.x saved a list under "shortcuts"
// (LEGACY_SHORTCUTS_STORAGE_KEY); it's migrated once (migrateLegacyShortcuts)
// and left in place, so an older version still finds it.
//
// No imports: the e2e flow can import this file with Node.

export type PageAction = 'openApp' | 'openLastLog' | 'edit' | 'save'

export interface PageShortcut {
  // Stable id: the built-ins' names ('app', 'debug-logs', …) or 'custom-<n>'.
  id: string
  name: string
  // One lower-case letter; '' turns the shortcut off.
  key: string
  // A navigation shortcut opens this path of the org…
  path?: string
  // …a built-in one runs an action.
  action?: PageAction
}

export interface PageShortcutSettings {
  version: 2
  // false: no shortcut on Salesforce pages, except opening Apex Debugger.
  enabled: boolean
  shortcuts: PageShortcut[]
}

export const SHORTCUTS_STORAGE_KEY = 'pageShortcuts'
export const LEGACY_SHORTCUTS_STORAGE_KEY = 'shortcuts'

export const DEFAULT_PAGE_SHORTCUTS: PageShortcut[] = [
  { id: 'app', name: 'Open Apex Debugger', key: 'w', action: 'openApp' },
  {
    id: 'last-log',
    name: 'Open the newest debug log',
    key: 'l',
    action: 'openLastLog'
  },
  {
    id: 'edit',
    name: 'Edit (clicks the page’s Edit button)',
    key: 'e',
    action: 'edit'
  },
  {
    id: 'save',
    name: 'Save (clicks the page’s Save button)',
    key: 's',
    action: 'save'
  },
  {
    id: 'debug-logs',
    name: 'Debug Logs',
    key: 'd',
    path: '/setup/ui/listApexTraces.apexp'
  },
  {
    id: 'custom-objects',
    name: 'Custom Objects',
    key: 'o',
    path: '/p/setup/custent/CustomObjectsPage'
  },
  {
    id: 'users',
    name: 'Manage Users',
    key: 'u',
    path: '/005?setupid=ManageUsers'
  },
  {
    id: 'profiles',
    name: 'Profiles',
    key: 'p',
    path: '/00e?setupid=EnhancedProfiles'
  },
  {
    id: 'classes',
    name: 'Classes (see all)',
    key: 'c',
    path: '/01p?all_classes_page%3AtheTemplate%3AclassList%3Arowsperpage=3500'
  },
  {
    id: 'triggers',
    name: 'Triggers (see all)',
    key: 't',
    path: '/setup/build/allTriggers.apexp?all_triggers_page%3AtheTemplate%3Aj_id41%3Arowsperpage=3000'
  },
  {
    id: 'outbound-change-sets',
    name: 'Outbound Change Sets',
    key: 'q',
    path: '/changemgmt/listOutboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=OutboundChangeSet'
  },
  {
    id: 'inbound-change-sets',
    name: 'Inbound Change Sets',
    key: 'z',
    path: '/changemgmt/listInboundChangeSet.apexp?retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3DDeploy&setupid=InboundChangeSet'
  },
  {
    id: 'schema-builder',
    name: 'Schema Builder',
    key: 's',
    path: '/_ui/platform/schema/ui/schemabuilder/SchemaBuilderUi?setupid=SchemaBuilder'
  }
]

// What each action does, for lists and the options page.
export const ACTION_DESCRIPTIONS: Record<PageAction, string> = {
  openApp: 'Opens the Apex Debugger log viewer for this org',
  openLastLog: 'Opens the newest debug log of the org',
  edit: 'Clicks Edit on classic record and setup pages',
  save: 'Clicks Save on classic record and setup pages (also in a field)'
}

export const defaultPageShortcutSettings = (): PageShortcutSettings => ({
  version: 2,
  enabled: true,
  shortcuts: DEFAULT_PAGE_SHORTCUTS.map(s => ({ ...s }))
})

// One key combination of a shortcut.
export interface Binding {
  // Mousetrap's notation: "shift+d", "alt+shift+d", "mod+s".
  combo: string
  // app-shortcuts.ts notation, for <Keys>: "Shift+d", "Mod+s".
  keys: string
  // newTab / sameTab: where a navigation (or the app) opens; run: an action.
  effect: 'newTab' | 'sameTab' | 'run'
}

export const isValidKey = (key: string) => /^[a-z]$/.test(key)

// Ctrl/Cmd combinations the browser keeps for itself (new tab, close tab, …),
// which a page can't or shouldn't take over.
export const RESERVED_MOD_KEYS = ['n', 'q', 't', 'w', 'l', 'r', 'f', 'h', 'j']

// The key combinations a shortcut binds. Navigation and the app: Shift+key
// in a new tab, Alt+Shift+key in this tab. Edit: Shift+key. Save: Ctrl/Cmd+key.
export function bindingsFor(shortcut: PageShortcut): Binding[] {
  const key = (shortcut.key || '').toLowerCase()
  if (!isValidKey(key)) return []
  if (shortcut.action === 'save') {
    return [{ combo: `mod+${key}`, keys: `Mod+${key}`, effect: 'run' }]
  }
  if (shortcut.action === 'edit') {
    return [{ combo: `shift+${key}`, keys: `Shift+${key}`, effect: 'run' }]
  }
  return [
    { combo: `shift+${key}`, keys: `Shift+${key}`, effect: 'newTab' },
    { combo: `alt+shift+${key}`, keys: `Alt+Shift+${key}`, effect: 'sameTab' }
  ]
}

// The shortcuts that are active: all of them, or only "Open Apex Debugger"
// when page shortcuts are turned off.
export function activeShortcuts(
  settings: PageShortcutSettings
): PageShortcut[] {
  return settings.shortcuts.filter(
    s => isValidKey(s.key) && (settings.enabled || s.action === 'openApp')
  )
}

// "Alt+Shift+d" -> "Alt+Shift+D", "Mod+s" -> "Ctrl/Cmd+S" (plain text). The
// default label of validateShortcuts; pages pass key-labels.ts keyText, which
// knows the platform (⌥⇧D, ⌘S on macOS).
export function comboLabel(keys: string): string {
  return keys
    .split('+')
    .map(part =>
      part === 'Mod'
        ? 'Ctrl/Cmd'
        : part.length === 1
          ? part.toUpperCase()
          : part
    )
    .join('+')
}

export interface Problem {
  id: string
  field: 'name' | 'key' | 'path'
  message: string
}

// What's wrong with a list of shortcuts: missing or invalid keys and paths,
// two shortcuts on the same key combination, browser shortcuts. Shortcuts
// with no key are off, which is fine. label: how messages show a key
// combination (app-shortcuts.ts notation in, text out).
export function validateShortcuts(
  shortcuts: PageShortcut[],
  label: (keys: string) => string = comboLabel
): Problem[] {
  const problems: Problem[] = []
  const owners = new Map<string, PageShortcut>()
  for (const shortcut of shortcuts) {
    if (!shortcut.action) {
      if (!(shortcut.path || '').trim()) {
        problems.push({
          id: shortcut.id,
          field: 'path',
          message: 'Enter the page to open, e.g. /001 or /lightning/setup/…'
        })
      } else if (/['"\s]/.test(shortcut.path.trim())) {
        problems.push({
          id: shortcut.id,
          field: 'path',
          message: 'A path can’t contain spaces or quotes.'
        })
      }
    }
    if (!shortcut.key) continue
    if (!isValidKey(shortcut.key)) {
      problems.push({
        id: shortcut.id,
        field: 'key',
        message: 'Use one letter, a to z.'
      })
      continue
    }
    if (
      shortcut.action === 'save' &&
      RESERVED_MOD_KEYS.includes(shortcut.key)
    ) {
      problems.push({
        id: shortcut.id,
        field: 'key',
        message: `The browser uses ${label(`Mod+${shortcut.key}`)} itself; pick another letter.`
      })
      continue
    }
    for (const binding of bindingsFor(shortcut)) {
      const owner = owners.get(binding.combo)
      if (owner && owner.id !== shortcut.id) {
        problems.push({
          id: shortcut.id,
          field: 'key',
          message: `${label(binding.keys)} is also used by “${owner.name || 'another shortcut'}”.`
        })
        break
      }
      owners.set(binding.combo, shortcut)
    }
  }
  return problems
}

// A path as the shortcut opens it: starts with "/".
export function normalizePath(path: string): string {
  const trimmed = (path || '').trim()
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

const ACTIONS: PageAction[] = ['openApp', 'openLastLog', 'edit', 'save']

function cleanShortcut(value: unknown): PageShortcut | null {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id) return null
  const key = typeof value.key === 'string' ? value.key.toLowerCase() : ''
  const shortcut: PageShortcut = {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : '',
    key: isValidKey(key) ? key : ''
  }
  if (ACTIONS.includes(value.action as PageAction)) {
    shortcut.action = value.action as PageAction
  } else if (typeof value.path === 'string' && value.path.trim()) {
    shortcut.path = normalizePath(value.path)
  } else {
    return null
  }
  return shortcut
}

// Settings saved by this version, or null if `saved` isn't any.
export function parsePageShortcutSettings(
  saved: unknown
): PageShortcutSettings | null {
  if (
    !isObject(saved) ||
    saved.version !== 2 ||
    !Array.isArray(saved.shortcuts)
  )
    return null
  const seen = new Set<string>()
  const shortcuts = saved.shortcuts
    .map(cleanShortcut)
    .filter(s => s && !seen.has(s.id) && seen.add(s.id))
  // "Open Apex Debugger" can't be removed.
  if (!shortcuts.some(s => s.action === 'openApp')) {
    shortcuts.unshift({ ...DEFAULT_PAGE_SHORTCUTS[0] })
  }
  return {
    version: 2,
    enabled: saved.enabled !== false,
    shortcuts
  }
}

// The paths of 0.8.x's defaults, to keep their ids.
const defaultIdByPath = new Map(
  DEFAULT_PAGE_SHORTCUTS.filter(s => s.path).map(s => [s.path, s.id])
)

// Shortcuts saved by 0.8.x: [{ name, key, path } | { name, key, app: true }].
// Keeps every custom shortcut, every key the user changed and every default
// the user removed (it stays removed). Adds what 0.8.x bound without saving
// (Shift+L, and Edit and Save, which were the bare keys e and s), unless one of
// the user's shortcuts already uses that combination: the user's shortcut wins,
// as it did, and the built-in is off.
export function migrateLegacyShortcuts(legacy: unknown): PageShortcutSettings {
  if (!Array.isArray(legacy)) return defaultPageShortcutSettings()
  const navigation: PageShortcut[] = []
  let app: PageShortcut | null = null
  const usedIds = new Set<string>()
  let custom = 0
  for (const entry of legacy) {
    if (!isObject(entry) || entry.token) continue
    const key =
      typeof entry.key === 'string' && isValidKey(entry.key.toLowerCase())
        ? entry.key.toLowerCase()
        : ''
    if (entry.app) {
      app = app || { ...DEFAULT_PAGE_SHORTCUTS[0], key: key || 'w' }
      continue
    }
    if (typeof entry.path !== 'string' || !entry.path.trim()) continue
    const path = normalizePath(entry.path)
    let id = defaultIdByPath.get(path)
    if (!id || usedIds.has(id)) {
      do id = `custom-${++custom}`
      while (usedIds.has(id))
    }
    usedIds.add(id)
    navigation.push({
      id,
      name: typeof entry.name === 'string' ? entry.name : '',
      key,
      path
    })
  }
  const shortcuts: PageShortcut[] = [app || { ...DEFAULT_PAGE_SHORTCUTS[0] }]
  const taken = new Set(
    [...shortcuts, ...navigation].flatMap(s => bindingsFor(s).map(b => b.combo))
  )
  for (const builtIn of DEFAULT_PAGE_SHORTCUTS.filter(
    s => s.action && s.action !== 'openApp'
  )) {
    const free = bindingsFor(builtIn).every(b => !taken.has(b.combo))
    const shortcut = { ...builtIn, key: free ? builtIn.key : '' }
    bindingsFor(shortcut).forEach(b => taken.add(b.combo))
    shortcuts.push(shortcut)
  }
  return { version: 2, enabled: true, shortcuts: [...shortcuts, ...navigation] }
}

// The user's page shortcuts from a chrome.storage area (sync): saved ones,
// else migrated from 0.8.x, else the defaults.
export async function loadPageShortcuts(storage: {
  get(keys: string[]): Promise<Record<string, unknown>>
}): Promise<PageShortcutSettings> {
  const saved = await storage.get([
    SHORTCUTS_STORAGE_KEY,
    LEGACY_SHORTCUTS_STORAGE_KEY
  ])
  return (
    parsePageShortcutSettings(saved[SHORTCUTS_STORAGE_KEY]) ||
    migrateLegacyShortcuts(saved[LEGACY_SHORTCUTS_STORAGE_KEY])
  )
}

// The active page shortcuts as a list for people (the "?" overlay, the
// options page): the main combination of each (Shift+key; Alt+Shift+key, the
// same in this tab, is explained once next to the list).
export function describePageShortcuts(
  settings: PageShortcutSettings
): { id: string; keys: string[]; description: string }[] {
  return activeShortcuts(settings).map(shortcut => ({
    id: shortcut.id,
    keys: bindingsFor(shortcut)
      .filter(b => b.effect !== 'sameTab')
      .map(b => b.keys),
    description: shortcut.action
      ? shortcut.name
      : `Open ${shortcut.name || shortcut.path}`
  }))
}

// A free id for a new shortcut.
export function newShortcutId(shortcuts: PageShortcut[]): string {
  let n = shortcuts.length
  while (shortcuts.some(s => s.id === `custom-${n}`)) n++
  return `custom-${n}`
}

// The classic pages' own keys (single letters, bound while no field has
// focus). None of them changes data. They follow the "page shortcuts" switch.
export interface LocalShortcut {
  id: string
  keys: string
  description: string
}

export const CLASSIC_LOG_PAGE_SHORTCUTS: LocalShortcut[] = [
  { id: 'toggleSystem', keys: 's', description: 'Show or hide system methods' },
  { id: 'toggleUser', keys: 'u', description: 'Show or hide user methods' },
  { id: 'toggleTimestamps', keys: 't', description: 'Show or hide timestamps' },
  {
    id: 'toggleExpand',
    keys: 'e',
    description: 'Expand or collapse all values'
  },
  { id: 'toggleWrap', keys: 'w', description: 'Wrap long lines on or off' }
]

export const CLASSIC_LOG_LIST_SHORTCUTS: LocalShortcut[] = [
  { id: 'loadNew', keys: 'l', description: 'Load new logs' },
  { id: 'search', keys: '/', description: 'Search in the logs' },
  { id: 'clearSearch', keys: 'c', description: 'Clear the search' }
]

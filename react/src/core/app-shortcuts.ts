// The log viewer's keyboard shortcuts, as data: the app binds them
// (pages/logs/use-app-shortcuts.js), the "?" overlay and tooltips list them.
// None of them deletes or changes data in Salesforce.
//
// Keys are KeyboardEvent.key values; "Mod" is Ctrl, or Cmd on macOS. They
// are shown with core/key-labels.ts (⌘ ⌥ ⇧ on macOS).
import { isMac, keyLabel, keyParts, keyText } from './key-labels'

export { isMac, keyLabel }

export type ShortcutId =
  | 'help'
  | 'search'
  | 'clearSearch'
  | 'nextRow'
  | 'previousRow'
  | 'openRow'
  | 'nextLog'
  | 'previousLog'
  | 'nextError'
  | 'nextDebug'
  | 'refresh'
  | 'find'
  | 'nextMatch'
  | 'previousMatch'
  | 'treeMove'
  | 'treeOpen'
  | 'treeClose'
  | 'treeEnds'
  | 'treeOpenSiblings'
  | 'treeGoToLine'
  | 'timelineZoomIn'
  | 'timelineZoomOut'
  | 'timelineWholeRun'
  | 'timelinePan'

export interface Shortcut {
  id: ShortcutId
  // Alternatives; each is one key, optionally with modifiers ("Shift+R").
  keys: string[]
  description: string
  group: 'General' | 'Log list' | 'Log' | 'Call tree' | 'Timeline'
}

export const APP_SHORTCUTS: Shortcut[] = [
  {
    id: 'help',
    keys: ['?'],
    description: 'Show keyboard shortcuts',
    group: 'General'
  },
  {
    id: 'search',
    keys: ['/'],
    description: 'Search in the loaded logs',
    group: 'General'
  },
  {
    id: 'clearSearch',
    keys: ['Escape'],
    description: 'Clear the search (in the search field)',
    group: 'General'
  },
  {
    id: 'refresh',
    keys: ['r', 'R'],
    description: 'Refresh the list of logs',
    group: 'General'
  },
  {
    id: 'nextRow',
    keys: ['j', 'ArrowDown'],
    description: 'Next log in the list',
    group: 'Log list'
  },
  {
    id: 'previousRow',
    keys: ['k', 'ArrowUp'],
    description: 'Previous log in the list',
    group: 'Log list'
  },
  {
    id: 'openRow',
    keys: ['Enter'],
    description: 'Open the selected log',
    group: 'Log list'
  },
  {
    id: 'nextLog',
    keys: [']'],
    description: 'Open the next (older) log',
    group: 'Log'
  },
  {
    id: 'previousLog',
    keys: ['['],
    description: 'Open the previous (newer) log',
    group: 'Log'
  },
  {
    id: 'find',
    keys: ['Mod+f'],
    description: 'Find in this log (press again for the browser’s find)',
    group: 'Log'
  },
  {
    id: 'nextMatch',
    keys: ['Enter', 'F3'],
    description: 'Next match (in the find field)',
    group: 'Log'
  },
  {
    id: 'previousMatch',
    keys: ['Shift+Enter', 'Shift+F3'],
    description: 'Previous match (in the find field)',
    group: 'Log'
  },
  {
    id: 'nextError',
    keys: ['e'],
    description: 'Go to the next error',
    group: 'Log'
  },
  {
    id: 'nextDebug',
    keys: ['d'],
    description: 'Go to the next debug line',
    group: 'Log'
  },
  // The call tree and the timeline handle these keys themselves while they
  // have focus (execution-tree-view.js, execution-timeline.js).
  {
    id: 'treeMove',
    keys: ['ArrowDown', 'ArrowUp'],
    description: 'Next or previous unit',
    group: 'Call tree'
  },
  {
    id: 'treeOpen',
    keys: ['ArrowRight'],
    description: 'Open the unit, or go to its first call',
    group: 'Call tree'
  },
  {
    id: 'treeClose',
    keys: ['ArrowLeft'],
    description: 'Close the unit, or go to its caller',
    group: 'Call tree'
  },
  {
    id: 'treeEnds',
    keys: ['Home', 'End'],
    description: 'First or last unit',
    group: 'Call tree'
  },
  {
    id: 'treeOpenSiblings',
    keys: ['*'],
    description: 'Open the unit and the others at its level',
    group: 'Call tree'
  },
  {
    id: 'treeGoToLine',
    keys: ['Enter'],
    description: 'Go to the unit’s line in the log',
    group: 'Call tree'
  },
  {
    id: 'timelineZoomIn',
    keys: ['+', '='],
    description: 'Zoom in (or Ctrl/⌘ and the mouse wheel)',
    group: 'Timeline'
  },
  {
    id: 'timelineZoomOut',
    keys: ['-'],
    description: 'Zoom out',
    group: 'Timeline'
  },
  {
    id: 'timelineWholeRun',
    keys: ['0'],
    description: 'Show the whole run',
    group: 'Timeline'
  },
  {
    id: 'timelinePan',
    keys: ['ArrowLeft', 'ArrowRight'],
    description: 'Move earlier or later (or Shift and the mouse wheel)',
    group: 'Timeline'
  }
]

// The first key of a shortcut, for tooltips: "Refresh (R)", "Find (⌘F)".
export function shortcutHint(id: ShortcutId, mac = isMac()): string {
  const shortcut = APP_SHORTCUTS.find(s => s.id === id)
  return shortcut ? keyText(shortcut.keys[0], mac) : ''
}

interface KeyLike {
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

// Whether a key event is this key ("Mod+f", "Shift+Enter", "?", "j").
// A single character is compared with the character typed, so Shift is
// part of it ("R" is Shift+r, "?" is Shift+/ on most layouts); other keys
// need exactly the modifiers named.
export function matchesKey(
  event: KeyLike,
  key: string,
  mac = isMac()
): boolean {
  const parts = keyParts(key)
  const main = parts.pop()
  const mod = mac ? event.metaKey : event.ctrlKey
  const otherMod = mac ? event.ctrlKey : event.metaKey
  if (Boolean(mod) !== parts.includes('Mod') || otherMod || event.altKey)
    return false
  if (main.length === 1) {
    return (
      event.key.length === 1 &&
      (parts.includes('Mod') ? event.key.toLowerCase() : event.key) === main
    )
  }
  return (
    event.key === main && Boolean(event.shiftKey) === parts.includes('Shift')
  )
}

// The shortcut a key event triggers, among `ids`, or null.
export function shortcutFor(
  event: KeyLike,
  ids: ShortcutId[],
  mac = isMac()
): ShortcutId | null {
  for (const shortcut of APP_SHORTCUTS) {
    if (!ids.includes(shortcut.id)) continue
    if (shortcut.keys.some(key => matchesKey(event, key, mac)))
      return shortcut.id
  }
  return null
}

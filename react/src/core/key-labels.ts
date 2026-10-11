// How keys are shown to people, everywhere keys are listed: the app's "?"
// overlay and tooltips, the options page, the classic pages' shortcut panels
// and the options page's conflict messages. On macOS modifiers are the
// symbols on the keyboard (⌘ ⌥ ⇧ ⌃); elsewhere their names.
//
// Keys are in app-shortcuts.ts notation: "Mod+f", "Alt+Shift+d", "?", where
// "Mod" is Ctrl, or Cmd on macOS. No imports (content scripts use it too).

export const isMac = (
  platform = typeof navigator === 'undefined' ? '' : navigator.platform
) => /mac|iphone|ipad/i.test(platform)

const MAC_MODIFIERS: Record<string, string> = {
  Mod: '⌘',
  Alt: '⌥',
  Shift: '⇧',
  Ctrl: '⌃'
}

const OTHER_MODIFIERS: Record<string, string> = {
  Mod: 'Ctrl'
}

const KEYS: Record<string, string> = {
  Escape: 'Esc',
  ArrowDown: '↓',
  ArrowUp: '↑'
}

// "Mod+f" -> ["⌘", "F"] on macOS, ["Ctrl", "F"] elsewhere; one entry per
// key, for <kbd> elements.
export function keyLabel(key: string, mac = isMac()): string[] {
  const modifiers = mac ? MAC_MODIFIERS : OTHER_MODIFIERS
  return key
    .split('+')
    .map(
      part =>
        modifiers[part] ||
        KEYS[part] ||
        (part.length === 1 ? part.toUpperCase() : part)
    )
}

// The same as plain text: "⌥⇧D" on macOS (as its menus show keys),
// "Alt+Shift+D" elsewhere.
export function keyText(key: string, mac = isMac()): string {
  return keyLabel(key, mac).join(mac ? '' : '+')
}

// The Ctrl/Cmd modifier alone, for sentences: "⌘" or "Ctrl".
export const modKeyName = (mac = isMac()) => (mac ? '⌘' : 'Ctrl')

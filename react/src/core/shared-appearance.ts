// The color mode the user picked in the app or on the options page
// (persisted-settings.ts keeps it in the extension's localStorage), mirrored
// to chrome.storage.local for the content scripts: the classic pages follow
// it, and they can't read the extension's localStorage.
import type { ColorModePreference } from '../ui/tokens'

export const APPEARANCE_STORAGE_KEY = 'appearance'

export interface SharedAppearance {
  colorMode: ColorModePreference
}

export function parseSharedAppearance(saved: unknown): SharedAppearance {
  const mode =
    saved && typeof saved === 'object'
      ? (saved as Record<string, unknown>).colorMode
      : undefined
  return {
    colorMode: mode === 'light' || mode === 'dark' ? mode : 'system'
  }
}

interface Area {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export async function readSharedAppearance(
  area: Area = chrome.storage.local
): Promise<SharedAppearance> {
  try {
    const saved = await area.get(APPEARANCE_STORAGE_KEY)
    return parseSharedAppearance(saved[APPEARANCE_STORAGE_KEY])
  } catch {
    return parseSharedAppearance(null)
  }
}

export async function writeSharedAppearance(
  appearance: SharedAppearance,
  area: Area = chrome.storage.local
): Promise<void> {
  try {
    await area.set({ [APPEARANCE_STORAGE_KEY]: appearance })
  } catch {
    // The classic pages then keep following the OS.
  }
}

// Calls `listener` whenever the app or the options page changes it.
export function onSharedAppearanceChange(
  listener: (appearance: SharedAppearance) => void
) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[APPEARANCE_STORAGE_KEY]) {
      listener(parseSharedAppearance(changes[APPEARANCE_STORAGE_KEY].newValue))
    }
  })
}

// The data-ad-color-mode value for a preference: none for 'system'
// (designTokensCss then follows prefers-color-scheme).
export function colorModeAttribute(
  preference: ColorModePreference
): 'light' | 'dark' | null {
  return preference === 'light' || preference === 'dark' ? preference : null
}

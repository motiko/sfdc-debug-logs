// The Redux store with the log viewer's state (pages/logs/logs-slice.ts) and
// its settings saved to the extension's localStorage (persisted-settings.ts),
// kept in step across extension pages: the app and the options page share the
// settings, so a change in one shows in the other at once (storage events).
// The color mode is also mirrored to chrome.storage.local for the classic
// pages (core/shared-appearance.ts).
//
// store.ts builds the app's store (with the Salesforce client); the options
// page builds one without it.
import { configureStore } from '@reduxjs/toolkit'
import logsPage, {
  initialLogsPageState,
  settingsLoaded
} from './pages/logs/logs-slice'
import {
  loadSettings,
  parseSettings,
  saveSettings,
  settingsChanged,
  STORAGE_KEY
} from './persisted-settings'
import { writeSharedAppearance } from './core/shared-appearance'

// localStorage and sessionStorage can throw when site data is blocked.
export const safeStorage = (get: () => Storage) => {
  try {
    return get()
  } catch {
    return undefined
  }
}

const hasChromeStorage = () =>
  typeof chrome !== 'undefined' &&
  Boolean(chrome.storage && chrome.storage.local)

export function createPersistedStore<Extra>(
  extraArgument: Extra,
  storage: Storage | undefined = safeStorage(() => window.localStorage),
  legacyStorage: Storage | undefined = safeStorage(() => window.sessionStorage)
) {
  const store = configureStore({
    reducer: { logsPage },
    preloadedState: {
      logsPage: {
        ...initialLogsPageState,
        ...(storage ? loadSettings(storage, legacyStorage) : {})
      }
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        thunk: { extraArgument },
        // Log bodies can be 20 MB strings; the development-only checks
        // would walk them on every action.
        immutableCheck: false,
        serializableCheck: false
      })
  })
  let saved = store.getState().logsPage
  // Applying settings another page saved (already in storage).
  let external = false
  const mirrorColorMode = () => {
    if (hasChromeStorage())
      writeSharedAppearance({ colorMode: store.getState().logsPage.colorMode })
  }
  store.subscribe(() => {
    const current = store.getState().logsPage
    if (storage && !external && settingsChanged(saved, current))
      saveSettings(storage, current)
    if (current.colorMode !== saved.colorMode) mirrorColorMode()
    saved = current
  })
  mirrorColorMode()
  if (storage && typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (event.key !== STORAGE_KEY || event.storageArea !== storage) return
      external = true
      try {
        store.dispatch(settingsLoaded(parseSettings(event.newValue)))
      } finally {
        external = false
      }
    })
  }
  return store
}

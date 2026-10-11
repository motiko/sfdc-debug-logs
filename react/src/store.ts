// The app's Redux store: state.logsPage (pages/logs/logs-slice.ts), with the
// Salesforce client (global-sf.ts) as the thunks' extra argument and the
// user's settings saved to localStorage (persisted-settings.ts).
import { configureStore } from '@reduxjs/toolkit'
import globalSf from './global-sf'
import logsPage, { initialLogsPageState } from './pages/logs/logs-slice'
import {
  loadSettings,
  saveSettings,
  settingsChanged
} from './persisted-settings'

// localStorage and sessionStorage can throw when site data is blocked.
const safe = (get: () => Storage) => {
  try {
    return get()
  } catch {
    return undefined
  }
}

export function createStore(
  storage: Storage | undefined = safe(() => window.localStorage),
  legacyStorage: Storage | undefined = safe(() => window.sessionStorage)
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
        thunk: { extraArgument: globalSf },
        // Log bodies can be 20 MB strings; the development-only checks
        // would walk them on every action.
        immutableCheck: false,
        serializableCheck: false
      })
  })
  let saved = store.getState().logsPage
  store.subscribe(() => {
    const current = store.getState().logsPage
    if (storage && settingsChanged(saved, current))
      saveSettings(storage, current)
    saved = current
  })
  return store
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

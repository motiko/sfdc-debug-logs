// The app's Redux store: state.logsPage (pages/logs/logs-slice.ts), with the
// Salesforce client (global-sf.ts) as the thunks' extra argument and the
// user's settings saved to localStorage and shared with the options page
// (settings-store.ts).
import globalSf from './global-sf'
import { createPersistedStore } from './settings-store'

export function createStore(storage?: Storage, legacyStorage?: Storage) {
  return createPersistedStore(globalSf, storage, legacyStorage)
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

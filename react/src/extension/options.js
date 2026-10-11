// Options page (html/options.html): the extension's settings, with the same
// design system and the same settings store as the app (settings-store.ts):
// Appearance, Keyboard shortcuts on Salesforce pages, and the advanced
// Session fallback.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createPersistedStore } from '../settings-store'
import OptionsPage from '../options/options-page'

// No Salesforce client: the options page makes no Salesforce calls.
const store = createPersistedStore(null)

createRoot(document.getElementById('container')).render(
  <StrictMode>
    <Provider store={store}>
      <OptionsPage />
    </Provider>
  </StrictMode>
)

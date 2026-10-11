// The full-page log viewer (html/app.html?oid=&uid=&sid=&host=).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import LogsPage from './pages/logs/logs'
import { createStore } from './store'
import Themed from './ui/themed'
import './app.css'

const store = createStore()

createRoot(document.getElementById('container')).render(
  <StrictMode>
    <Provider store={store}>
      <Themed>
        <LogsPage />
      </Themed>
    </Provider>
  </StrictMode>
)

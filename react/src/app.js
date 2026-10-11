// The full-page log viewer (html/app.html?oid=&uid=&sid=&host=).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import LogsPage from './pages/logs/logs'
import { createStore } from './store'
import { appTheme } from './theme'
import './app.css'

const store = createStore()

createRoot(document.getElementById('container')).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <Provider store={store}>
        <LogsPage />
      </Provider>
    </ThemeProvider>
  </StrictMode>
)

// The full-page log viewer (html/app.html?oid=&uid=&sid=&host=).
import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSelector } from 'react-redux'
import { CssBaseline, GlobalStyles } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import LogsPage from './pages/logs/logs'
import { createStore } from './store'
import { createAppTheme } from './ui/theme'
import { useReducedMotion, useResolvedColorMode } from './ui/color-mode'
import { tokenCssVariables } from './ui/tokens'
import './app.css'

const store = createStore()

// The MUI theme and the design tokens (as --ad-* custom properties) for the
// user's color mode, which follows the OS unless they picked one.
function Themed({ children }) {
  const preference = useSelector(state => state.logsPage.colorMode)
  const mode = useResolvedColorMode(preference)
  const theme = createAppTheme(mode, useReducedMotion())
  const variables = useMemo(
    () => ({ ':root': tokenCssVariables(mode) }),
    [mode]
  )
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={variables} />
      {children}
    </ThemeProvider>
  )
}

createRoot(document.getElementById('container')).render(
  <StrictMode>
    <Provider store={store}>
      <Themed>
        <LogsPage />
      </Themed>
    </Provider>
  </StrictMode>
)

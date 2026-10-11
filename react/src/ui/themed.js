import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { CssBaseline, GlobalStyles } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { createAppTheme } from './theme'
import { useReducedMotion, useResolvedColorMode } from './color-mode'
import { tokenCssVariables } from './tokens'

// The MUI theme and the design tokens (as --ad-* custom properties) for the
// user's color mode, which follows the OS unless they picked one. Used by
// every extension page (the app, the options page).
export default function Themed({ children }) {
  const preference = useSelector(state => state.logsPage.colorMode)
  const mode = useResolvedColorMode(preference)
  const theme = createAppTheme(mode, useReducedMotion())
  const variables = useMemo(
    () => ({
      ':root': tokenCssVariables(mode),
      // Visually hidden, still read by screen readers.
      '.sr-only': {
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }
    }),
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

// The app's MUI themes: light pages (white background, dark text) under a
// teal app bar, whose contents use a dark theme so text and inputs are white.
import { createTheme } from '@mui/material/styles'
import { indigo, teal } from '@mui/material/colors'

export const appTheme = createTheme({
  palette: {
    primary: teal,
    secondary: indigo,
    background: { default: '#fff', paper: '#fff' }
  }
})

export const toolbarTheme = createTheme({
  palette: { mode: 'dark', primary: teal, secondary: indigo }
})

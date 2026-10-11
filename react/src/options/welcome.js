import { Box, Button, Paper, Typography } from '@mui/material'
import Keys from '../ui/components/kbd'

// First-run welcome, at the top of the options page: the service worker opens
// html/options.html#welcome once, when the extension is installed (not on
// updates). Says how to open the log viewer without knowing the shortcut,
// that logging has to be started, and where the settings are. "Got it"
// removes it (and the #welcome, so a reload doesn't bring it back).
export default function Welcome({ onDismiss }) {
  const item = (title, body) => (
    <Box component="li" sx={{ mb: 1.5 }}>
      <Typography component="h3" variant="h3" sx={{ mb: 0.25 }}>
        {title}
      </Typography>
      <Typography variant="body2" component="div">
        {body}
      </Typography>
    </Box>
  )
  return (
    <Paper
      component="section"
      id="welcome"
      aria-labelledby="welcome-title"
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        borderColor: 'primary.main',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}
    >
      <Typography id="welcome-title" component="h2" variant="h2">
        Welcome to Apex Debugger
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
        {item(
          'Open the log viewer',
          <>
            On a Salesforce tab (Lightning, Setup or Salesforce Classic), click
            the Apex Debugger button in the browser toolbar, or press{' '}
            <Keys keys="Shift+w" />. To keep the button in view, pin it from the
            browser’s Extensions menu (the puzzle piece).
          </>
        )}
        {item(
          'Start logging',
          'Salesforce writes debug logs only while logging is on for you. In the log viewer, choose “Start logging”: it logs your Apex for 24 hours. Run your code, then refresh the list.'
        )}
        {item(
          'Settings',
          'They are on this page: appearance and keyboard shortcuts. Open it again from the log viewer’s “More actions” menu (Extension options), or with the toolbar button on a tab that isn’t Salesforce.'
        )}
      </Box>
      <Box>
        <Button variant="contained" onClick={onDismiss}>
          Got it
        </Button>
      </Box>
    </Paper>
  )
}

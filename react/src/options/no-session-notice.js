import { forwardRef } from 'react'
import { Alert, AlertTitle } from '@mui/material'

// Shown at the top of the options page when the toolbar button was clicked on
// a Salesforce org tab that has no session (background.ts opens
// html/options.html#no-session): says to log in to the org first. An alert
// (MUI's default role), labeled by its title, so it is announced also when
// the worker sets the hash on an open options tab.
const NoSessionNotice = forwardRef(function NoSessionNotice({ onClose }, ref) {
  return (
    <Alert
      ref={ref}
      id="no-session-notice"
      aria-labelledby="no-session-title"
      tabIndex={-1}
      severity="info"
      variant="outlined"
      onClose={onClose}
      slotProps={{ closeButton: { 'aria-label': 'Close this notice' } }}
      sx={{ outline: 'none', '&:focus-visible': { boxShadow: 'none' } }}
    >
      <AlertTitle id="no-session-title" component="h2" sx={{ fontSize: 16 }}>
        Log in to Salesforce first
      </AlertTitle>
      The Apex Debugger button opens the log viewer for the Salesforce org of
      the tab you’re on, but that tab has no Salesforce session. Log in to the
      org in that tab (or reload it if your session expired), then click the
      button again.
    </Alert>
  )
})

export default NoSessionNotice

import { Box, Snackbar } from '@mui/material'

// Readable by screen readers, invisible on screen.
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
}

// Clears the log list's footer (its text and "Load 50 more" button, about 40 px).
const ABOVE_LIST_FOOTER = 56

// A confirmation ("Deleted 36 logs", "Logging stopped"): shown for 5 s at the
// bottom left, above the log list's footer and away from the header's
// controls and menus, and announced politely by screen readers. Errors don't
// go here; they stay inline until resolved.
//
// Only the message itself takes clicks: the rest of the snackbar's box lets
// them through to the page. With reduced motion the theme's transition
// durations are 0, so it appears and goes without animating.
//
// The announcement comes from a live region that is always in the page, so
// screen readers notice the change (a region inserted together with its text
// is often missed); the visible copy is hidden from them so it isn't read
// twice.
export default function Toast({ toast, onClose }) {
  return (
    <>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {toast ? <span key={toast.key}>{toast.message}</span> : null}
      </Box>
      <Snackbar
        key={toast ? toast.key : 'none'}
        open={Boolean(toast)}
        message={toast ? toast.message : ''}
        autoHideDuration={5000}
        onClose={(event, reason) => reason !== 'clickaway' && onClose()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{
          pointerEvents: 'none',
          bottom: { xs: ABOVE_LIST_FOOTER, sm: ABOVE_LIST_FOOTER }
        }}
        slotProps={{
          content: {
            'aria-hidden': true,
            'data-testid': 'toast',
            sx: { pointerEvents: 'auto' }
          }
        }}
      />
    </>
  )
}

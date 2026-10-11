import { Snackbar } from '@mui/material'

// A confirmation ("Deleted 36 logs", "Saved"): shown for 5 s near the top
// right, under the header, and announced politely by screen readers. Errors
// don't go here; they stay inline until resolved.
export default function Toast({ toast, onClose }) {
  return (
    <Snackbar
      key={toast ? toast.key : 'none'}
      open={Boolean(toast)}
      message={toast ? toast.message : ''}
      autoHideDuration={5000}
      onClose={(event, reason) => reason !== 'clickaway' && onClose()}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ top: { xs: 56, sm: 56 } }}
      slotProps={{ content: { role: 'status', 'aria-live': 'polite' } }}
    />
  )
}

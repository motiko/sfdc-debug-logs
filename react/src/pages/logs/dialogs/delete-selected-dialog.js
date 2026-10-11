import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Typography
} from '@mui/material'
import { deleteLogsById } from '../actions'
import { explainError } from '../../../core/salesforce/errors'
import { formatBytes, formatFullTime, shortOperation } from '../utils'

const logsText = count =>
  count === 1 ? '1 log' : `${count.toLocaleString()} logs`

// Confirms deleting exactly these logs: the list's checked logs ("Delete
// selected…") or the open log ("Delete log…"). The confirm button names the
// count; Cancel has the focus. Logs Salesforce refused stay listed and can
// be tried again. onDeleted hears the ids that were deleted.
export default function DeleteSelectedDialog({
  open,
  ids,
  logs,
  onClose,
  onDeleted,
  host
}) {
  const dispatch = useDispatch()
  // Fixed when the dialog opens, so a refresh can't change what is deleted.
  const [pending, setPending] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [refused, setRefused] = useState(null)
  const running = progress !== null

  useEffect(() => {
    if (!open) return
    setPending(ids || [])
    setProgress(null)
    setError(null)
    setRefused(null)
    // Only when it opens: ids is a new array on every render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const count = pending.length
  const records = pending
    .map(id => (logs || []).find(log => log.Id === id))
    .filter(Boolean)
  const totalBytes = records.reduce((sum, log) => sum + (log.LogLength || 0), 0)
  const single = count === 1 ? records[0] : null

  const run = async () => {
    setError(null)
    setRefused(null)
    setProgress({ done: 0, total: count })
    try {
      const result = await dispatch(deleteLogsById(pending, setProgress))
      setProgress(null)
      if (result.deleted.length) onDeleted(result.deleted)
      if (result.failed.length === 0) {
        onClose()
        return
      }
      setRefused({ deleted: result.deleted.length, failed: result.failed })
      setPending(result.failed.map(f => f.id))
    } catch (err) {
      setProgress(null)
      setError(explainError(err, host))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={running ? undefined : onClose}
      aria-labelledby="delete-selected-title"
      aria-describedby="delete-selected-description"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="delete-selected-title">
        {count === 1 ? 'Delete this log?' : `Delete ${logsText(count)}?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          id="delete-selected-description"
          sx={{ color: 'text.primary' }}
        >
          {single
            ? `${shortOperation(single.Operation)}, ${formatFullTime(single.StartTime)} (${formatBytes(single.LogLength)}). `
            : count > 1
              ? `The ${logsText(count)} you selected (${formatBytes(totalBytes)}). `
              : ''}
          Deleted logs can’t be restored.
        </DialogContentText>
        {running ? (
          <Box sx={{ mt: 2 }} role="status">
            <Typography variant="body2" sx={{ mb: 1 }}>
              Deleting {logsText(progress.total)}…
            </Typography>
            <LinearProgress
              aria-label="Deleting logs"
              variant="determinate"
              value={
                progress.total ? (100 * progress.done) / progress.total : 0
              }
            />
          </Box>
        ) : null}
        {refused ? (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {refused.deleted ? `Deleted ${logsText(refused.deleted)}. ` : ''}
            Salesforce didn’t delete {logsText(refused.failed.length)}:{' '}
            {refused.failed[0].message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {error.title} {error.hint}
            <Box component="details" sx={{ mt: 0.5, fontSize: 12 }}>
              <summary>Details</summary>
              {error.detail}
            </Box>
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={running} autoFocus>
          {refused ? 'Close' : 'Cancel'}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={run}
          disabled={running || count === 0}
        >
          {refused
            ? `Try ${logsText(count)} again`
            : `Delete ${logsText(count)}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

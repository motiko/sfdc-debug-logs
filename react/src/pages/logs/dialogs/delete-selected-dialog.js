import { useEffect, useRef, useState } from 'react'
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

const describe = log =>
  `${shortOperation(log.Operation)}, ${formatFullTime(log.StartTime)} (${formatBytes(log.LogLength)})`

const logsText = count =>
  count === 1 ? '1 log' : `${count.toLocaleString()} logs`

// Confirms deleting exactly these logs: the list's checked logs ("Delete
// selected…") or the open log ("Delete log…"). The confirm button names the
// count; Cancel has the focus. Logs Salesforce refused stay listed and can
// be tried again; the dialog then says what happened and focuses Close.
// onDeleted hears the ids that were deleted, onExited that it has closed.
export default function DeleteSelectedDialog({
  open,
  ids,
  logs,
  onClose,
  onDeleted,
  onExited,
  host
}) {
  const dispatch = useDispatch()
  // Fixed when the dialog opens, so a refresh can't change what is deleted.
  const [pending, setPending] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [refused, setRefused] = useState(null)
  // A try failed (refused or not sent): the dialog now offers to try again,
  // also while that next try runs.
  const [failed, setFailed] = useState(false)
  const running = progress !== null
  const closeRef = useRef(null)
  // After a failure the confirm button may have had the focus while it was
  // disabled: Close gets it, next to the message.
  useEffect(() => {
    if ((refused || error) && closeRef.current) closeRef.current.focus()
  }, [refused, error])

  useEffect(() => {
    if (!open) return
    setPending(ids || [])
    setProgress(null)
    setError(null)
    setRefused(null)
    setFailed(false)
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
      setFailed(true)
      setPending(result.failed.map(f => f.id))
    } catch (err) {
      setProgress(null)
      setError(explainError(err, host))
      setFailed(true)
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
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id="delete-selected-title">
        {failed
          ? `Couldn’t delete ${logsText(count)}`
          : count === 1
            ? 'Delete this log?'
            : `Delete ${logsText(count)}?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          id="delete-selected-description"
          sx={{ color: 'text.primary' }}
        >
          {failed
            ? single
              ? `${describe(single)} is still in the list.`
              : `${logsText(count)} are still in the list.`
            : `${
                single
                  ? `${describe(single)}. `
                  : count > 1
                    ? `The ${logsText(count)} you selected (${formatBytes(totalBytes)}). `
                    : ''
              }Deleted logs can’t be restored.`}
        </DialogContentText>
        {running ? (
          <Box sx={{ mt: 2 }} role="status">
            <Typography variant="body2" sx={{ mb: 1 }}>
              Deleting {logsText(progress.total)}…
            </Typography>
            {/* Moving while the first request runs (up to 200 logs). */}
            <LinearProgress
              aria-label="Deleting logs"
              variant={progress.done ? 'determinate' : 'indeterminate'}
              value={
                progress.total ? (100 * progress.done) / progress.total : 0
              }
            />
          </Box>
        ) : null}
        {refused ? (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {refused.deleted
              ? `Deleted ${logsText(refused.deleted)}; Salesforce refused the ${refused.failed.length === 1 ? 'other one' : 'others'}. `
              : ''}
            {`Salesforce said: “${refused.failed[0].message}”`}
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
        <Button ref={closeRef} onClick={onClose} disabled={running} autoFocus>
          {failed ? 'Close' : 'Cancel'}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={run}
          disabled={running || count === 0}
        >
          {failed
            ? `Try ${logsText(count)} again`
            : `Delete ${logsText(count)}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

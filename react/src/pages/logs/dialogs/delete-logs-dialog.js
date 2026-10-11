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
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Typography
} from '@mui/material'
import { countLogs, deleteLogs } from '../actions'
import { explainError } from '../../../core/salesforce/errors'

const STEP_TEXT = {
  finding: 'Finding the logs…',
  uploading: 'Sending the delete job to Salesforce…',
  deleting: 'Salesforce is deleting the logs…'
}

const n = count => (count === null ? '…' : count.toLocaleString())
const logsWord = count => (count === 1 ? 'log' : 'logs')

// "Delete logs…": choose only my logs (default) or every user's logs in the
// org, see how many, confirm with a button that names the action, follow the
// progress; the result is confirmed in a toast (docs/ux/baseline-review.md B4).
export default function DeleteLogsDialog({ open, onClose, host }) {
  const dispatch = useDispatch()
  const [scope, setScope] = useState('mine')
  const [counts, setCounts] = useState({ mine: null, all: null })
  const [countError, setCountError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const running = progress !== null

  useEffect(() => {
    if (!open) return
    let current = true
    setScope('mine')
    setCounts({ mine: null, all: null })
    setCountError(null)
    setProgress(null)
    setError(null)
    dispatch(countLogs()).then(
      result => current && setCounts(result),
      err => current && setCountError(explainError(err, host))
    )
    return () => {
      current = false
    }
  }, [open, dispatch, host])

  const count = counts[scope]
  const run = async () => {
    setError(null)
    setProgress({ step: 'finding', total: count })
    try {
      await dispatch(deleteLogs(scope, setProgress))
      setProgress(null)
      onClose()
    } catch (err) {
      setProgress(null)
      setError(explainError(err, host))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={running ? undefined : onClose}
      aria-labelledby="delete-logs-title"
      aria-describedby="delete-logs-description"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="delete-logs-title">Delete debug logs</DialogTitle>
      <DialogContent>
        <DialogContentText
          id="delete-logs-description"
          sx={{ mb: 2, color: 'text.primary' }}
        >
          Deleted logs can’t be restored.
        </DialogContentText>
        <RadioGroup
          aria-label="Which logs to delete"
          value={scope}
          onChange={e => setScope(e.target.value)}
          sx={{ gap: 0.5 }}
        >
          <FormControlLabel
            value="mine"
            disabled={running}
            control={<Radio />}
            label={
              <span>
                Only my logs{' '}
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  ({n(counts.mine)})
                </Box>
              </span>
            }
          />
          <FormControlLabel
            value="all"
            disabled={running}
            control={<Radio />}
            label={
              <span>
                All users’ logs in {host}{' '}
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  ({n(counts.all)})
                </Box>
              </span>
            }
          />
        </RadioGroup>
        {scope === 'all' ? (
          <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
            This also deletes other developers’ logs in this org.
          </Typography>
        ) : null}
        {countError ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Couldn’t count the logs. {countError.title}
          </Alert>
        ) : null}
        {running ? (
          <Box sx={{ mt: 2 }} role="status">
            <Typography variant="body2" sx={{ mb: 1 }}>
              {STEP_TEXT[progress.step]}
            </Typography>
            <LinearProgress aria-label="Deleting logs" />
          </Box>
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
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={run}
          disabled={running || !count}
        >
          {count === 0
            ? 'No logs to delete'
            : `Delete ${count === null ? '' : `${n(count)} `}${logsWord(count)}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

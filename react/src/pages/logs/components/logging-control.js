import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material'
import DotIcon from '@mui/icons-material/FiberManualRecord'
import ArrowIcon from '@mui/icons-material/ArrowDropDown'
import WarningIcon from '@mui/icons-material/WarningAmber'
import {
  checkLogging,
  extendLogging,
  startLogging,
  stopLogging
} from '../actions'
import { formatClock } from '../utils'
import TraceFlagsDialog from '../dialogs/trace-flags-dialog'

// Whether the user's actions are logged (an active USER_DEBUG trace flag),
// and until when: "Logging on · until 15:42" with Extend and Stop, or
// "Logging off" with "Start logging". Checks when the app opens, but never
// starts logging on its own (docs/ux/baseline-review.md M11). "Trace flags…"
// opens the dialog for other debug levels, durations and targets.
export default function LoggingControl({ host }) {
  const dispatch = useDispatch()
  const logging = useSelector(state => state.logsPage.logging)
  const [anchor, setAnchor] = useState(null)
  const [traceOpen, setTraceOpen] = useState(false)
  const traceDialog = (
    <TraceFlagsDialog
      open={traceOpen}
      onClose={() => setTraceOpen(false)}
      host={host}
    />
  )

  useEffect(() => {
    dispatch(checkLogging())
  }, [dispatch])

  const close = () => setAnchor(null)
  const run = action => () => {
    close()
    dispatch(action())
  }
  const busy = logging.busy ? (
    <CircularProgress size={14} aria-label="Updating logging" />
  ) : null

  if (logging.status === 'unknown' || logging.status === 'error') {
    return (
      <Tooltip
        title={
          logging.error ? `${logging.error.title} ${logging.error.hint}` : ''
        }
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {logging.status === 'unknown' ? (
            <Box
              component="span"
              role="status"
              sx={{ fontSize: 13, color: 'text.secondary', px: 1 }}
            >
              Checking logging…
            </Box>
          ) : (
            <Button
              variant="text"
              color="inherit"
              startIcon={<WarningIcon sx={{ color: 'warning.main' }} />}
              onClick={() => dispatch(checkLogging())}
            >
              Logging status unknown · Retry
            </Button>
          )}
        </Box>
      </Tooltip>
    )
  }

  if (logging.status === 'off') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="span"
          sx={{
            fontSize: 13,
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          <DotIcon sx={{ fontSize: 10, color: 'text.secondary' }} aria-hidden />
          Logging off
        </Box>
        <Button
          variant="outlined"
          onClick={() => dispatch(startLogging())}
          disabled={logging.busy}
          startIcon={busy}
        >
          Start logging
        </Button>
        <Button
          variant="text"
          color="inherit"
          aria-haspopup="dialog"
          onClick={() => setTraceOpen(true)}
        >
          Trace flags…
        </Button>
        {logging.error ? <ErrorNote error={logging.error} /> : null}
        {traceDialog}
      </Box>
    )
  }

  return (
    <>
      <Button
        variant="text"
        color="inherit"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? 'logging-menu' : undefined}
        onClick={e => setAnchor(e.currentTarget)}
        startIcon={
          busy || (
            <DotIcon sx={{ fontSize: 10, color: 'success.main' }} aria-hidden />
          )
        }
        endIcon={<ArrowIcon />}
        sx={{ fontWeight: 500 }}
      >
        Logging on · until {formatClock(logging.expiresAt)}
      </Button>
      {logging.error ? <ErrorNote error={logging.error} /> : null}
      <Menu
        id="logging-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-label': 'Logging', dense: true } }}
      >
        <MenuItem onClick={run(extendLogging)}>
          <ListItemText primary="Extend to 24 hours from now" />
        </MenuItem>
        <MenuItem onClick={run(stopLogging)}>
          <ListItemText
            primary="Stop logging"
            secondary="Removes your active trace flag"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            setTraceOpen(true)
          }}
        >
          <ListItemText
            primary="Trace flags…"
            secondary="Debug level, duration, other users and classes"
          />
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ '&.Mui-disabled': { opacity: 1 } }}>
          <ListItemText
            primary={`Debug level: ${logging.debugLevel || 'unknown'}`}
            secondary={`Logs your actions until ${new Date(logging.expiresAt).toLocaleString()}`}
          />
        </MenuItem>
      </Menu>
      {traceDialog}
    </>
  )
}

function ErrorNote({ error }) {
  return (
    <Tooltip title={`${error.title} ${error.hint}`}>
      <WarningIcon
        role="img"
        aria-label={`Logging: ${error.title}`}
        sx={{ color: 'warning.main', fontSize: 18 }}
      />
    </Tooltip>
  )
}

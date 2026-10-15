import { useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Box,
  Button,
  ListItemIcon,
  MenuItem,
  MenuList,
  Popover,
  Tooltip
} from '@mui/material'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled'
import PauseIcon from '@mui/icons-material/PauseCircleOutlined'
import WarningIcon from '@mui/icons-material/WarningAmber'
import ArrowIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import { setAutoRefresh } from '../logs-slice'
import {
  AUTO_REFRESH_INTERVALS,
  describeAutoRefresh,
  intervalLabel
} from '../auto-refresh'

// "Auto-refresh: Off / 10 s / 30 s / 60 s" with a menu to choose; the
// label says when it is paused or retrying, and the tooltip and the list's
// footer say why (logging off, tab in the background, Salesforce not
// answering). See use-auto-refresh.js.
export default function AutoRefreshControl({ state, interval, failing }) {
  const dispatch = useDispatch()
  const [anchor, setAnchor] = useState(null)
  const close = () => setAnchor(null)
  const choose = seconds => () => {
    close()
    dispatch(setAutoRefresh(seconds))
  }
  const paused = state === 'paused-logging' || state === 'paused-hidden'
  const icon =
    state === 'off' ? (
      <SyncDisabledIcon />
    ) : failing ? (
      <WarningIcon sx={{ color: 'warning.main' }} />
    ) : paused ? (
      <PauseIcon />
    ) : (
      <AutorenewIcon sx={{ color: 'success.main' }} />
    )
  return (
    <>
      <Tooltip
        title={describeAutoRefresh(state, interval, failing)}
        describeChild
      >
        <Button
          variant="text"
          color="inherit"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? 'auto-refresh-menu' : undefined}
          onClick={e => setAnchor(e.currentTarget)}
          startIcon={icon}
          endIcon={<ArrowIcon />}
          data-state={state}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {autoRefreshLabel(state, interval, failing)}
        </Button>
      </Tooltip>
      {/* A popover rather than a Menu: the note under the choices is not a
          menu item (it can't be reached or chosen), it describes the menu. */}
      <Popover
        id="auto-refresh-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList
          autoFocusItem
          variant="selectedMenu"
          dense
          aria-label="Auto-refresh"
          aria-describedby="auto-refresh-note"
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              close()
            }
          }}
        >
          {AUTO_REFRESH_INTERVALS.map(seconds => (
            <MenuItem
              key={seconds}
              role="menuitemradio"
              aria-checked={seconds === interval}
              selected={seconds === interval}
              onClick={choose(seconds)}
            >
              <ListItemIcon>
                {seconds === interval ? <CheckIcon fontSize="small" /> : null}
              </ListItemIcon>
              {intervalLabel(seconds)}
            </MenuItem>
          ))}
        </MenuList>
        <Box
          id="auto-refresh-note"
          component="p"
          sx={{
            m: 0,
            px: 2,
            pt: 0.5,
            pb: 1.5,
            maxWidth: 280,
            fontSize: 12,
            color: 'text.secondary'
          }}
        >
          Checks only while your logging is on and this tab is in front. Each
          check is one small API request.
        </Box>
      </Popover>
    </>
  )
}

// The button's text, also its accessible name: the interval, and whether it
// is paused or retrying (the tooltip says why).
export function autoRefreshLabel(state, interval, failing) {
  if (state === 'off' || !interval) return 'Auto-refresh: Off'
  const suffix =
    state === 'paused-logging' || state === 'paused-hidden'
      ? ' (paused)'
      : failing
        ? ' (retrying)'
        : ''
  return `Auto-refresh: ${interval} s${suffix}`
}

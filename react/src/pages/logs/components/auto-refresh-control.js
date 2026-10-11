import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Button, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material'
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
// tooltip and the list's footer say whether it is running or paused
// (logging off, tab in the background). See use-auto-refresh.js.
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
          Auto-refresh: {interval ? `${interval} s` : 'Off'}
          {paused ? ' (paused)' : ''}
        </Button>
      </Tooltip>
      <Menu
        id="auto-refresh-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-label': 'Auto-refresh', dense: true } }}
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
        <MenuItem
          disabled
          sx={{
            '&.Mui-disabled': { opacity: 1 },
            whiteSpace: 'normal',
            maxWidth: 280,
            fontSize: 12,
            color: 'text.secondary'
          }}
        >
          Checks only while your logging is on and this tab is in front. Each
          check is one small API request.
        </MenuItem>
      </Menu>
    </>
  )
}

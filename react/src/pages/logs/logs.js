import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  AppBar,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  TextField,
  Toolbar,
  Tooltip
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import HomeIcon from '@mui/icons-material/Home'
import RefreshIcon from '@mui/icons-material/Autorenew'
import DeleteIcon from '@mui/icons-material/DeleteForever'
import FilterList from '@mui/icons-material/FilterList'
import StyleIcon from '@mui/icons-material/Style'
import LogView from './components/log-view'
import TrackingLogs from './components/tracking-logs'
import Search from './components/search'
import LogsTable from './components/logs-table'
import FilterDialog from './dialogs/filter/filter-dialog'
import StyleDialog from './dialogs/style/style'
import { loadLogs, deleteAll, search } from './actions'
import {
  setMessage,
  toggleFiltersDialog,
  toggleStyleDialog,
  updateMaxLogs
} from './logs-slice'
import { filterLogs } from './utils'
import { logHash, useOpenLogId } from '../../hash-route'
import { toolbarTheme } from '../../theme'

// The distinct operations, statuses and users of the loaded logs, for the
// filter dialog's selects.
function possibleFieldValues(logs) {
  const unique = values => [...new Set(values)]
  const all = Object.values(logs)
  return {
    operation: unique(all.map(log => log.Operation)),
    status: unique(all.map(log => log.Status)),
    user: unique(all.map(log => log.LogUser.Name))
  }
}

export default function LogsPage() {
  const dispatch = useDispatch()
  const logId = useOpenLogId()
  const logs = useSelector(state => state.logsPage.logs)
  const filters = useSelector(state => state.logsPage.filters)
  const notMatchingSearchLogs = useSelector(
    state => state.logsPage.notMatchingSearchLogs
  )
  const loading = useSelector(state => state.logsPage.loading)
  const message = useSelector(state => state.logsPage.message)
  const maxLogs = useSelector(state => state.logsPage.maxLogs)
  const filtersDialogOpen = useSelector(
    state => state.logsPage.filtersDialogOpen
  )
  const styleDialogOpen = useSelector(state => state.logsPage.styleDialogOpen)

  const refresh = () => dispatch(loadLogs())

  // Load the logs on start; "r" reloads them and "a" deletes all logs
  // (outside text fields).
  useEffect(() => {
    dispatch(loadLogs())
    const onKeyUp = e => {
      if (e.target.nodeName === 'INPUT' || e.target.nodeName === 'TEXTAREA') {
        return
      }
      if (e.key === 'r') dispatch(loadLogs())
      if (e.key === 'a') dispatch(deleteAll())
    }
    document.body.addEventListener('keyup', onKeyUp)
    return () => document.body.removeEventListener('keyup', onKeyUp)
  }, [dispatch])

  const fieldValues = useMemo(() => possibleFieldValues(logs), [logs])
  const shownLogs = useMemo(
    () => filterLogs(logs, filters, notMatchingSearchLogs),
    [logs, filters, notMatchingSearchLogs]
  )

  const toolbarButton = (title, label, Icon, onClick) => (
    <Tooltip title={title}>
      <IconButton color="inherit" aria-label={label} onClick={onClick}>
        <Icon />
      </IconButton>
    </Tooltip>
  )

  return (
    <Box sx={{ pt: '64px', overflow: 'hidden' }}>
      <AppBar position="fixed" sx={{ height: 64 }}>
        {/* White text and inputs on the teal bar; the rest of the app is light. */}
        <ThemeProvider theme={toolbarTheme}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Home">
                <IconButton
                  color="inherit"
                  aria-label="Home"
                  href={logHash(null)}
                >
                  <HomeIcon />
                </IconButton>
              </Tooltip>
              <Search handleSearch={term => dispatch(search(term))} />
              {toolbarButton('Load logs', 'Load logs', RefreshIcon, refresh)}
              {toolbarButton('Filter logs', 'Filter logs', FilterList, () =>
                dispatch(toggleFiltersDialog())
              )}
              {toolbarButton('Delete All', 'Delete all logs', DeleteIcon, () =>
                dispatch(deleteAll())
              )}
              {toolbarButton(
                'Style settings',
                'Style settings',
                StyleIcon,
                () => dispatch(toggleStyleDialog())
              )}
              {loading ? (
                <CircularProgress size={32} sx={{ color: 'white', ml: 1 }} />
              ) : null}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <TextField
                variant="standard"
                value={maxLogs}
                type="number"
                onChange={e => dispatch(updateMaxLogs(e.target.value))}
                label="Max Logs"
                placeholder="1"
                sx={{ width: '6em', mb: '2px' }}
                onBlur={refresh}
              />
              <TrackingLogs />
            </Box>
          </Toolbar>
        </ThemeProvider>
      </AppBar>
      <Snackbar
        open={message !== ''}
        autoHideDuration={1000}
        disableWindowBlurListener
        onClose={() => dispatch(setMessage(''))}
        message={message}
      />
      <FilterDialog
        open={filtersDialogOpen}
        possibleFieldValues={fieldValues}
      />
      <StyleDialog
        open={styleDialogOpen}
        onClose={() => dispatch(toggleStyleDialog())}
      />
      {logId ? <LogView logId={logId} /> : <LogsTable logs={shownLogs} />}
    </Box>
  )
}

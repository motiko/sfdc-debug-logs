import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Fab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip
} from '@mui/material'
import ArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import ArrowRight from '@mui/icons-material/KeyboardArrowRight'
import FilterList from '@mui/icons-material/FilterList'
import ParsedLog from './parsed-log.js'
import { fetchLogBody } from '../actions'
import { toggleContentsFilter, toggleSideLogs } from '../logs-slice'
import { filterLogs } from '../utils'
import { openLog } from '../../../hash-route'
import ContentsFilter from '../dialogs/log-content-filter/contents-filter'

const timeFormatter = Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false
})

// A log (#/logs/<id>): the loaded logs on the left, the log's body on the
// right.
export default function LogView({ logId }) {
  const dispatch = useDispatch()
  const logs = useSelector(state => state.logsPage.logs)
  const sideLogsOpen = useSelector(state => state.logsPage.sideLogsOpen)
  const logBody = useSelector(state => state.logsPage.logBodies[logId] || '')
  const filters = useSelector(state => state.logsPage.filters)
  const notMatchingSearchLogs = useSelector(
    state => state.logsPage.notMatchingSearchLogs
  )
  const styleConfig = useSelector(state => state.logsPage.styleConfig)
  // State rather than a ref: the log body needs it to render its lines.
  const [scrollElement, setScrollElement] = useState(null)

  useEffect(() => {
    dispatch(fetchLogBody(logId))
  }, [dispatch, logId])
  useEffect(() => {
    if (scrollElement) scrollElement.scrollTop = 0
  }, [scrollElement, logId])

  const sideLogs = useMemo(
    () => filterLogs(logs, filters, notMatchingSearchLogs),
    [logs, filters, notMatchingSearchLogs]
  )

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: sideLogsOpen ? '20%' : '0%',
          pl: 0,
          position: 'fixed',
          left: 0,
          top: 64,
          bottom: 0,
          overflowY: 'scroll',
          overflowX: 'hidden',
          bgcolor: 'background.default'
        }}
      >
        <List sx={{ width: '100%', pl: '15px' }}>
          {sideLogs.map(log => {
            const text = (
              <ListItemText
                primary={`${timeFormatter.format(new Date(log.StartTime))}    ${log.DurationMilliseconds}ms`}
                secondary={`${log.Operation}    ${log.LogLength / 1000}k`}
              />
            )
            return log.Id === logId ? (
              <ListItem key={log.Id} sx={{ boxShadow: '-4px 0 gray' }}>
                {text}
              </ListItem>
            ) : (
              <ListItemButton key={log.Id} onClick={() => openLog(log.Id)}>
                {text}
              </ListItemButton>
            )
          })}
        </List>
      </Box>
      <Box
        ref={setScrollElement}
        sx={{
          width: sideLogsOpen ? '80%' : '100%',
          overflowY: 'scroll',
          position: 'fixed',
          right: 0,
          top: 64,
          bottom: 0
        }}
        style={{ backgroundColor: styleConfig.theme.background }}
      >
        <Fab
          size="small"
          aria-label={sideLogsOpen ? 'Hide log list' : 'Show log list'}
          onClick={() => dispatch(toggleSideLogs())}
          sx={{ position: 'fixed', left: -16, top: 72 }}
        >
          {sideLogsOpen ? <ArrowLeft /> : <ArrowRight />}
        </Fab>
        <ParsedLog
          key={logId}
          body={logBody}
          styleConfig={styleConfig}
          scrollElement={scrollElement}
        />
        <Tooltip title="Filter log content" placement="left-end">
          <Fab
            size="small"
            aria-label="Filter log content"
            onClick={() => dispatch(toggleContentsFilter())}
            sx={{ position: 'fixed', right: 24, top: 72, zIndex: 999 }}
          >
            <FilterList />
          </Fab>
        </Tooltip>
        <ContentsFilter />
      </Box>
    </Box>
  )
}

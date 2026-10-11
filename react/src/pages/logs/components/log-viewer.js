import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  InputAdornment,
  Popover,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import UpIcon from '@mui/icons-material/KeyboardArrowUp'
import DownIcon from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import ErrorIcon from '@mui/icons-material/ErrorOutlined'
import DebugIcon from '@mui/icons-material/BugReportOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import DownloadIcon from '@mui/icons-material/Download'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CloseIcon from '@mui/icons-material/Close'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import ReportIcon from '@mui/icons-material/ReportProblemOutlined'
import ParsedLog from './parsed-log'
import ExecutionTreeView from './execution-tree-view'
import ExecutionTimeline from './execution-timeline'
import globalSf from '../../../global-sf'
import { StatusLabel } from './log-list'
import IconAction from '../../../ui/components/icon-action'
import StatePanel from '../../../ui/components/state-panel'
import { fetchLogBody } from '../actions'
import { showAllCategories, toggleCategory } from '../logs-slice'
import { openLog } from '../../../hash-route'
import {
  buildLines,
  categoryCounts,
  findMatches,
  isDebugLine,
  isErrorLine,
  nextRow,
  visibleLines
} from '../../../core/log/log-lines'
import { CATEGORY_LABELS } from '../../../core/log/categories'
import {
  buildExecutionTree,
  rowForLine
} from '../../../core/log/execution-tree'
import {
  paletteFor,
  themeCssVariables,
  withCustomColors
} from '../../../core/log/themes'
import {
  formatBytes,
  formatDuration,
  formatFullTime,
  isFailed,
  shortOperation
} from '../utils'
import { shortcutHint } from '../../../core/app-shortcuts'

const FIND_DELAY_MS = 200

// The opened log (#/logs/<id>): its metadata and actions, a toolbar (find
// with a match counter, next error / next debug line, event-type toggles
// with counts, expand all values), and the log body. A failed run opens at
// its first error, any other log at the top. Tabs switch the body to the
// call tree or the timeline (built only when first shown); choosing a unit
// there goes back to the log at its line. The ref offers the page's
// shortcuts: focusFind(), nextError(), nextDebug().
const LogViewer = forwardRef(function LogViewer(
  { logId, log, colorMode, initialFind },
  ref
) {
  const dispatch = useDispatch()
  const body = useSelector(state => state.logsPage.logBodies[logId])
  const loading = useSelector(state =>
    Boolean(state.logsPage.bodyLoading[logId])
  )
  const error = useSelector(state => state.logsPage.bodyErrors[logId])
  const styleConfig = useSelector(state => state.logsPage.styleConfig)
  const hidden = useSelector(state => state.logsPage.hiddenCategories)
  const host = globalSf.hostname

  const [scrollElement, setScrollElement] = useState(null)
  const parsedRef = useRef(null)
  const findRef = useRef(null)
  const [findInput, setFindInput] = useState(initialFind || '')
  const [term, setTerm] = useState(initialFind || '')
  const [current, setCurrent] = useState(0)
  const [activeRow, setActiveRow] = useState(-1)
  const [expandAll, setExpandAll] = useState(false)
  const [eventsAnchor, setEventsAnchor] = useState(null)
  // 'log', 'tree' or 'timeline'.
  const [chosenView, setView] = useState('log')
  // The views shown so far (the tree is built when one is first shown).
  const [shown, setShown] = useState({ log: true })
  const treeWanted = Boolean(shown.tree || shown.timeline)
  const pendingRow = useRef(null)

  useEffect(() => {
    dispatch(fetchLogBody(logId))
  }, [dispatch, logId])

  const allLines = useMemo(() => buildLines(body || ''), [body])
  const lines = useMemo(
    () => visibleLines(allLines, hidden),
    [allLines, hidden]
  )
  const counts = useMemo(() => categoryCounts(allLines), [allLines])
  const tree = useMemo(
    () => (treeWanted && body ? buildExecutionTree(allLines) : null),
    [treeWanted, body, allLines]
  )
  // The log until the tree can be built (its body is loading).
  const view = tree ? chosenView : 'log'
  const hiddenCount = hidden.reduce((n, c) => n + (counts[c] || 0), 0)
  const matches = useMemo(() => findMatches(lines, term), [lines, term])
  const matchRows = useMemo(() => new Set(matches.map(m => m.row)), [matches])
  const errorCount = counts.error
  const debugCount = useMemo(
    () => allLines.filter(isDebugLine).length,
    [allLines]
  )

  const theme = useMemo(
    () =>
      withCustomColors(
        paletteFor(styleConfig.theme, colorMode),
        styleConfig.colors
      ),
    [styleConfig.theme, styleConfig.colors, colorMode]
  )
  const cssVariables = useMemo(() => themeCssVariables(theme), [theme])

  // Debounced find; the counter restarts at the first match.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(findInput.trim()), FIND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [findInput])
  useEffect(() => setCurrent(0), [term])

  // A newly opened log starts at the top, or at its first error if the run
  // failed (docs/ux/baseline-review.md M7).
  const positioned = useRef(null)
  useEffect(() => {
    if (!scrollElement || !body || positioned.current === logId) return
    positioned.current = logId
    setActiveRow(-1)
    const failed = log
      ? isFailed(log)
      : allLines.some(l => l.eventType === 'FATAL_ERROR')
    const firstError = failed ? lines.findIndex(isErrorLine) : -1
    scrollElement.scrollTop = 0
    if (firstError > 0) {
      setActiveRow(firstError)
      requestAnimationFrame(
        () => parsedRef.current && parsedRef.current.scrollToRow(firstError)
      )
    }
  }, [scrollElement, body, logId, log, lines, allLines])

  const goToMatch = index => {
    if (!matches.length) return
    const i = (index + matches.length) % matches.length
    setCurrent(i)
    setActiveRow(matches[i].row)
    parsedRef.current && parsedRef.current.scrollToRow(matches[i].row)
  }
  // Scroll to the current match once a new term has results.
  useEffect(() => {
    if (matches.length && parsedRef.current) {
      setActiveRow(matches[0].row)
      parsedRef.current.scrollToRow(matches[0].row)
    }
  }, [matches])

  // The row the next/previous jumps start from: the last one jumped to, or
  // the first line in view.
  const startRow = () => {
    if (activeRow >= 0) return activeRow
    if (!scrollElement) return -1
    const top = scrollElement.getBoundingClientRect().top
    const rows = [...scrollElement.querySelectorAll('pre > div[data-index]')]
    const firstVisible = rows.find(
      r => r.getBoundingClientRect().bottom > top + 1
    )
    return firstVisible ? Number(firstVisible.dataset.index) - 1 : -1
  }
  const showView = next => {
    setShown(prev => (prev[next] ? prev : { ...prev, [next]: true }))
    setView(next)
  }
  // From the call tree or the timeline: the log, at the unit's line (or the
  // next line shown, if its event type is hidden).
  const goToLine = number => {
    const row = rowForLine(lines, number)
    if (row < 0) return
    setActiveRow(row)
    pendingRow.current = row
    setView('log')
  }
  useEffect(() => {
    if (view !== 'log' || pendingRow.current === null) return
    const row = pendingRow.current
    pendingRow.current = null
    requestAnimationFrame(() => {
      parsedRef.current && parsedRef.current.scrollToRow(row)
      scrollElement && scrollElement.focus({ preventScroll: true })
    })
  }, [view, scrollElement])
  // Shortcuts for the log body bring it back first.
  const inLog = action => () => {
    if (view === 'log') action()
    else {
      setView('log')
      requestAnimationFrame(() => requestAnimationFrame(action))
    }
  }

  const jump = (test, dir = 1) => {
    const row = nextRow(lines, Math.max(-1, startRow()), dir, test)
    if (row < 0) return
    setActiveRow(row)
    parsedRef.current && parsedRef.current.scrollToRow(row)
  }

  useImperativeHandle(ref, () => ({
    focusFind: inLog(() => {
      if (findRef.current) {
        findRef.current.focus()
        findRef.current.select()
      }
    }),
    isFindFocused: () => document.activeElement === findRef.current,
    nextError: inLog(() => jump(isErrorLine)),
    nextDebug: inLog(() => jump(isDebugLine))
  }))

  const onFindKeyDown = e => {
    if (e.key === 'Enter' || e.key === 'F3') {
      e.preventDefault()
      setTerm(findInput.trim())
      goToMatch(
        current +
          (e.shiftKey
            ? -1
            : matches.length && term === findInput.trim()
              ? 1
              : 0)
      )
    } else if (e.key === 'Escape' && findInput) {
      e.stopPropagation()
      setFindInput('')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `apex-log-${logId}.log`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const counter = term
    ? matches.length
      ? `${current + 1} of ${matches.length}`
      : 'No matches'
    : ''

  return (
    <Box
      component="section"
      aria-label="Log"
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper'
      }}
    >
      {/* Metadata and actions. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          columnGap: 2,
          rowGap: 0.5,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography
          component="h2"
          variant="h2"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={log ? log.Operation : logId}
        >
          {log ? shortOperation(log.Operation) : logId}
        </Typography>
        {log ? (
          <Box
            component="dl"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              m: 0,
              fontSize: 13,
              color: 'text.secondary',
              '& dt': {
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)'
              },
              '& dd': { m: 0 }
            }}
          >
            <dt>Status</dt>
            <dd>
              <StatusLabel log={log} />
            </dd>
            <dt>Started</dt>
            <dd>{formatFullTime(log.StartTime)}</dd>
            <dt>Duration</dt>
            <dd>{formatDuration(log.DurationMilliseconds)}</dd>
            <dt>Size</dt>
            <dd>{formatBytes(log.LogLength)}</dd>
            <dt>User</dt>
            <dd>{log.LogUser && log.LogUser.Name}</dd>
          </Box>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconAction
            label="Download log"
            icon={<DownloadIcon />}
            onClick={download}
            disabled={!body}
          />
          <IconAction
            label="Open in Salesforce"
            icon={<OpenInNewIcon />}
            component="a"
            href={`https://${host}/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${encodeURIComponent(logId)}`}
            target="_blank"
            rel="noreferrer"
          />
          <IconAction
            label="Close log"
            shortcut="Esc"
            icon={<CloseIcon />}
            onClick={() => openLog(null)}
          />
        </Box>
      </Box>

      {/* The log, its call tree or its timeline. */}
      <Tabs
        value={view}
        onChange={(_, next) => showView(next)}
        aria-label="Log views"
        sx={{
          minHeight: 36,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none' }
        }}
      >
        {LOG_VIEWS.map(([value, label]) => (
          <Tab
            key={value}
            value={value}
            label={label}
            id={`log-view-${value}`}
            aria-controls={`log-view-panel-${value}`}
            disabled={value !== 'log' && !body}
          />
        ))}
      </Tabs>

      {/* Find, navigation and event types. */}
      <Box
        role="toolbar"
        aria-label="Log tools"
        sx={{
          display: view === 'log' ? 'flex' : 'none',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <TextField
          inputRef={findRef}
          value={findInput}
          onChange={e => setFindInput(e.target.value)}
          onKeyDown={onFindKeyDown}
          placeholder="Find in log"
          autoComplete="off"
          sx={{ width: 240 }}
          slotProps={{
            htmlInput: {
              'aria-label': 'Find in log',
              'aria-keyshortcuts': 'Control+F Meta+F',
              'aria-describedby': 'find-counter'
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" aria-hidden />
                </InputAdornment>
              )
            }
          }}
        />
        <Typography
          id="find-counter"
          variant="body2"
          color="text.secondary"
          role="status"
          sx={{ minWidth: 72, fontVariantNumeric: 'tabular-nums' }}
        >
          {counter}
        </Typography>
        <IconAction
          label="Previous match"
          shortcut="Shift+Enter"
          icon={<UpIcon />}
          onClick={() => goToMatch(current - 1)}
          disabled={!matches.length}
        />
        <IconAction
          label="Next match"
          shortcut="Enter"
          icon={<DownIcon />}
          onClick={() => goToMatch(current + 1)}
          disabled={!matches.length}
        />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip
          title={`Next error (${shortcutHint('nextError')})`}
          describeChild
        >
          <span>
            <Button
              variant="text"
              color={errorCount ? 'error' : 'inherit'}
              startIcon={<ErrorIcon />}
              onClick={() => jump(isErrorLine)}
              disabled={!errorCount}
              aria-keyshortcuts="e"
            >
              Next error{errorCount ? ` (${errorCount})` : ''}
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          title={`Next debug line (${shortcutHint('nextDebug')})`}
          describeChild
        >
          <span>
            <Button
              variant="text"
              color="inherit"
              startIcon={<DebugIcon />}
              onClick={() => jump(isDebugLine)}
              disabled={!debugCount}
              aria-keyshortcuts="d"
            >
              Next debug{debugCount ? ` (${debugCount})` : ''}
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="text"
          color="inherit"
          startIcon={<TuneIcon />}
          aria-haspopup="dialog"
          aria-expanded={Boolean(eventsAnchor)}
          onClick={e => setEventsAnchor(e.currentTarget)}
        >
          {hiddenCount ? `Events · ${hiddenCount} hidden` : 'Events'}
        </Button>
        <Button
          variant="text"
          color="inherit"
          startIcon={expandAll ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
          aria-pressed={expandAll}
          onClick={() => setExpandAll(v => !v)}
        >
          {expandAll ? 'Collapse values' : 'Expand values'}
        </Button>
        <EventsPopover
          anchor={eventsAnchor}
          onClose={() => setEventsAnchor(null)}
          counts={counts}
          hidden={hidden}
        />
      </Box>

      {/* The log body: one Tab stop; arrows and Page keys scroll it. */}
      <Box
        ref={setScrollElement}
        role="region"
        aria-label="Log body"
        id="log-view-panel-log"
        tabIndex={0}
        sx={{
          display: view === 'log' ? 'block' : 'none',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          color: 'var(--log-rest-color)',
          backgroundColor: 'var(--log-background)',
          '&:focus-visible': {
            outline: '2px solid var(--ad-focus)',
            outlineOffset: -2
          }
        }}
        style={cssVariables}
        data-theme={theme.name}
      >
        {error ? (
          <Box sx={{ bgcolor: 'background.paper', height: '100%' }}>
            <StatePanel
              role="alert"
              tone="error"
              icon={<ReportIcon />}
              title={`This log couldn't be loaded. ${error.title}`}
              details={error.detail}
              actions={
                <Button
                  variant="contained"
                  onClick={() => dispatch(fetchLogBody(logId, { retry: true }))}
                >
                  Retry
                </Button>
              }
            >
              {error.hint}
            </StatePanel>
          </Box>
        ) : !body ? (
          <Box sx={{ p: 2 }} aria-busy={loading} aria-label="Loading log">
            {Array.from({ length: 14 }, (_, i) => (
              <Skeleton
                key={i}
                variant="text"
                width={`${40 + ((i * 37) % 55)}%`}
                sx={{
                  bgcolor:
                    'color-mix(in srgb, var(--log-muted) 25%, transparent)'
                }}
              />
            ))}
          </Box>
        ) : (
          <ParsedLog
            ref={parsedRef}
            lines={lines}
            fontSize={styleConfig.fontSize}
            textWrap={styleConfig.textWrap}
            scrollElement={scrollElement}
            term={term}
            matchRows={matchRows}
            currentMatch={matches[current]}
            activeRow={activeRow}
            expandAll={expandAll}
          />
        )}
      </Box>
      {/* Kept once shown, so going to a line and back keeps their state. */}
      {tree
        ? LOG_VIEWS.filter(([value]) => value !== 'log' && shown[value]).map(
            ([value]) => (
              <Box
                key={value}
                role="tabpanel"
                id={`log-view-panel-${value}`}
                aria-labelledby={`log-view-${value}`}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: view === value ? 'flex' : 'none',
                  flexDirection: 'column'
                }}
              >
                {value === 'tree' ? (
                  <ExecutionTreeView
                    key={logId}
                    tree={tree}
                    onJump={goToLine}
                  />
                ) : (
                  <ExecutionTimeline
                    key={logId}
                    tree={tree}
                    theme={theme}
                    onJump={goToLine}
                  />
                )}
              </Box>
            )
          )
        : null}
    </Box>
  )
})

export default LogViewer

const LOG_VIEWS = [
  ['log', 'Log'],
  ['tree', 'Call tree'],
  ['timeline', 'Timeline']
]

// Which event categories the log body shows, with the number of lines of
// each (docs/ux/baseline-review.md M6).
function EventsPopover({ anchor, onClose, counts, hidden }) {
  const dispatch = useDispatch()
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': 'Event types',
          sx: { p: 2, width: 300 }
        }
      }}
    >
      <Typography component="h2" variant="h2" sx={{ mb: 1 }}>
        Show event types
      </Typography>
      <Box
        component="fieldset"
        sx={{ border: 0, m: 0, p: 0, display: 'flex', flexDirection: 'column' }}
      >
        <legend className="sr-only">Event types to show</legend>
        {Object.keys(CATEGORY_LABELS).map(category => (
          <FormControlLabel
            key={category}
            sx={{
              mr: 0,
              '& .MuiFormControlLabel-label': {
                flex: 1,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13
              }
            }}
            control={
              <Checkbox
                size="small"
                checked={!hidden.includes(category)}
                onChange={() => dispatch(toggleCategory(category))}
              />
            }
            label={
              <>
                <span>{CATEGORY_LABELS[category]}</span>
                <Box
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {counts[category] || 0}
                </Box>
              </>
            }
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Button
          onClick={() => dispatch(showAllCategories())}
          disabled={!hidden.length}
        >
          Show all
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </Box>
    </Popover>
  )
}

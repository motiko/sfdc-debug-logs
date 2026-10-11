import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Alert, Box, Button, LinearProgress, Link } from '@mui/material'
import ListIcon from '@mui/icons-material/ViewList'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import InboxIcon from '@mui/icons-material/Inbox'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import AppHeader from './components/app-header'
import FilterBar from './components/filter-bar'
import LogList, { LogListSkeleton } from './components/log-list'
import LogViewer from './components/log-viewer'
import AppearancePanel from './dialogs/appearance-panel'
import DeleteLogsDialog from './dialogs/delete-logs-dialog'
import ShortcutsDialog from './dialogs/shortcuts-dialog'
import IconAction from '../../ui/components/icon-action'
import StatePanel from '../../ui/components/state-panel'
import Toast from '../../ui/components/toast'
import { useResolvedColorMode } from '../../ui/color-mode'
import { clearFilters, clearSearch, loadLogs, startLogging } from './actions'
import { hideToast, toggleSideLogs } from './logs-slice'
import {
  filterLogs,
  formatClock,
  formatRelative,
  shortOperation,
  sortLogs
} from './utils'
import { openLog, useOpenLogId } from '../../hash-route'
import { useAppShortcuts } from './use-app-shortcuts'
import { useAutoRefresh } from './use-auto-refresh'
import { describeAutoRefresh } from './auto-refresh'
import globalSf from '../../global-sf'
import { layout } from '../../ui/tokens'

// The app shell: header, search and filter bar, and the logs as a sortable
// table, or (with a log open) a compact list next to the log viewer.
export default function LogsPage() {
  const dispatch = useDispatch()
  const logId = useOpenLogId()
  const page = useSelector(state => state.logsPage)
  const {
    logs,
    listStatus,
    listError,
    filters,
    search,
    maxLogs,
    sideLogsOpen,
    newIds,
    toast,
    loadedAt
  } = page
  const colorMode = useResolvedColorMode(page.colorMode)
  const [sort, setSort] = useState({ key: 'time', direction: 'desc' })
  const [dialog, setDialog] = useState(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const viewerRef = useRef(null)
  const host = globalSf.hostname

  useEffect(() => {
    dispatch(loadLogs())
  }, [dispatch])

  const autoRefresh = useAutoRefresh({ openId: logId })
  const scrollAnchor = useScrollAnchor(logs)

  const shownLogs = useMemo(
    () => sortLogs(filterLogs(logs, filters, search.matches), sort),
    [logs, filters, search.matches, sort]
  )
  const openRecord = logs.find(log => log.Id === logId)
  const showUser = useMemo(
    () => new Set(logs.map(l => l.LogUser && l.LogUser.Name)).size > 1,
    [logs]
  )

  useEffect(() => {
    document.title = openRecord
      ? `${shortOperation(openRecord.Operation)} · Apex Debugger`
      : `Debug logs · ${host} · Apex Debugger`
  }, [openRecord, host])

  const refresh = useCallback(() => dispatch(loadLogs()), [dispatch])
  const step = delta => {
    const index = shownLogs.findIndex(l => l.Id === logId)
    const next = shownLogs[index + delta]
    if (next) openLog(next.Id)
  }

  useAppShortcuts({
    enabled: dialog === null,
    logOpen: Boolean(logId),
    onHelp: () => setDialog('help'),
    onSearch: () => searchRef.current && searchRef.current.focus(),
    onRefresh: refresh,
    onRow: delta => listRef.current && listRef.current.moveFocus(delta),
    onLog: step,
    onFind: () => viewerRef.current && viewerRef.current.focusFind(),
    isFindFocused: () =>
      Boolean(viewerRef.current && viewerRef.current.isFindFocused()),
    onNextError: () => viewerRef.current && viewerRef.current.nextError(),
    onNextDebug: () => viewerRef.current && viewerRef.current.nextDebug(),
    onClose: () => openLog(null)
  })

  const loading = listStatus === 'loading'
  const firstLoad = (listStatus === 'idle' || loading) && loadedAt === null
  const filtered =
    search.matches !== null || Object.values(filters).some(Boolean)

  let listContent
  if (listStatus === 'error' && logs.length === 0) {
    listContent = <ListError error={listError} host={host} onRetry={refresh} />
  } else if (firstLoad) {
    listContent = (
      <Box role="status" aria-label="Loading logs">
        <LogListSkeleton compact={Boolean(logId)} />
      </Box>
    )
  } else if (shownLogs.length === 0) {
    listContent = filtered ? (
      <StatePanel
        icon={<SearchOffIcon />}
        title={
          search.matches !== null
            ? `No logs contain “${search.term}”`
            : 'No logs match the filters'
        }
        actions={
          <>
            {search.matches !== null ? (
              <Button
                variant="outlined"
                onClick={() => dispatch(clearSearch())}
              >
                Clear search
              </Button>
            ) : null}
            {Object.values(filters).some(Boolean) ? (
              <Button
                variant="outlined"
                onClick={() => dispatch(clearFilters())}
              >
                Clear filters
              </Button>
            ) : null}
          </>
        }
      >
        The search covers the {logs.length} loaded logs.
      </StatePanel>
    ) : (
      <EmptyList onRefresh={refresh} host={host} />
    )
  } else {
    listContent = (
      <LogList
        ref={listRef}
        logs={shownLogs}
        openId={logId}
        compact={Boolean(logId)}
        sort={sort}
        onSort={key =>
          setSort(s => ({
            key,
            direction: s.key === key && s.direction === 'desc' ? 'asc' : 'desc'
          }))
        }
        newIds={newIds}
        matches={search.matches}
        showUser={showUser}
        loading={loading}
      />
    )
  }

  const listPane = (
    <Box
      component="section"
      aria-label="Debug logs"
      sx={{
        width: logId ? `clamp(260px, 28vw, ${layout.listWidth}px)` : '100%',
        flex: logId ? 'none' : 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: logId ? 1 : 0,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      {logId ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 40
          }}
        >
          <Box
            component="h2"
            sx={{ m: 0, fontSize: 13, fontWeight: 600, flex: 1 }}
          >
            Logs
          </Box>
          <IconAction
            label="Hide log list"
            icon={<ChevronLeftIcon />}
            onClick={() => dispatch(toggleSideLogs())}
          />
        </Box>
      ) : null}
      {listStatus === 'error' && logs.length > 0 ? (
        <Alert
          severity="error"
          role="alert"
          sx={{ m: 1 }}
          action={
            <Button color="inherit" size="small" onClick={refresh}>
              Retry
            </Button>
          }
        >
          Refresh failed. {listError.title}
        </Alert>
      ) : null}
      <Box
        ref={scrollAnchor.ref}
        onScroll={scrollAnchor.onScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowAnchor: 'none'
        }}
      >
        {listContent}
      </Box>
      {logs.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderTop: 1,
            borderColor: 'divider',
            fontSize: 12,
            color: 'text.secondary'
          }}
        >
          <span>
            {logs.length < maxLogs
              ? `All ${logs.length} logs loaded`
              : `Newest ${logs.length} logs loaded`}
            {loadedAt ? ` · updated ${formatRelative(loadedAt)}` : ''}
            {autoRefresh.state !== 'off' ? ' ·' : ''}
          </span>
          {autoRefresh.state !== 'off' ? (
            <Box
              component="span"
              data-testid="auto-refresh-status"
              sx={autoRefresh.failing ? { color: 'warning.main' } : null}
            >
              {describeAutoRefresh(
                autoRefresh.state,
                autoRefresh.interval,
                autoRefresh.failing
              )}
            </Box>
          ) : null}
          {logs.length >= maxLogs ? (
            <Button
              size="small"
              onClick={() => dispatch(loadLogs({ more: true }))}
              disabled={loading}
            >
              Load {50} more
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default'
      }}
    >
      <AppHeader
        host={host}
        onRefresh={refresh}
        refreshing={loading}
        autoRefresh={autoRefresh}
        onHelp={() => setDialog('help')}
        onAppearance={() => setDialog('appearance')}
        onDelete={() => setDialog('delete')}
      />
      <Box sx={{ position: 'relative' }}>
        <FilterBar ref={searchRef} shownCount={shownLogs.length} />
        {loading && !firstLoad ? (
          <LinearProgress
            aria-label="Loading logs"
            sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          />
        ) : null}
      </Box>
      <Box component="main" sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {logId && !sideLogsOpen ? (
          <Box
            sx={{
              width: layout.listRailWidth,
              flex: 'none',
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              pt: 0.5,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <IconAction
              label="Show log list"
              icon={<ListIcon />}
              onClick={() => dispatch(toggleSideLogs())}
              tooltipPlacement="right"
            />
          </Box>
        ) : (
          listPane
        )}
        {logId ? (
          <LogViewer
            key={logId}
            ref={viewerRef}
            logId={logId}
            log={openRecord}
            colorMode={colorMode}
            initialFind={search.matches !== null ? search.term : ''}
          />
        ) : null}
      </Box>
      <AppearancePanel
        open={dialog === 'appearance'}
        onClose={() => setDialog(null)}
        colorMode={colorMode}
      />
      <DeleteLogsDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        host={host}
      />
      <ShortcutsDialog
        open={dialog === 'help'}
        onClose={() => setDialog(null)}
      />
      <Toast toast={toast} onClose={() => dispatch(hideToast())} />
      {/* New logs from auto-refresh, announced politely. */}
      <Box
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="auto-refresh-announcement"
      >
        {autoRefresh.announcement ? (
          <span key={autoRefresh.announcement.key}>
            {autoRefresh.announcement.text}
          </span>
        ) : null}
      </Box>
    </Box>
  )
}

// Keeps the list where the user scrolled it when rows are added above (an
// auto-refresh poll or a refresh): the first visible row stays in place.
// At the top, new rows show up at the top.
function useScrollAnchor(logs) {
  const ref = useRef(null)
  const anchor = useRef(null)
  const record = useCallback(() => {
    const el = ref.current
    anchor.current = null
    if (!el || el.scrollTop === 0) return
    const top = el.getBoundingClientRect().top
    for (const row of el.querySelectorAll('[data-log-id]')) {
      const rect = row.getBoundingClientRect()
      if (rect.bottom > top) {
        anchor.current = { id: row.dataset.logId, offset: rect.top - top }
        return
      }
    }
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    const kept = anchor.current
    if (el && kept) {
      const row = [...el.querySelectorAll('[data-log-id]')].find(
        r => r.dataset.logId === kept.id
      )
      if (row) {
        el.scrollTop +=
          row.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          kept.offset
      }
    }
    record()
  }, [logs, record])
  return { ref, onScroll: record }
}

function ListError({ error, host, onRetry }) {
  return (
    <StatePanel
      role="alert"
      tone="error"
      icon={<CloudOffIcon />}
      title={error.title}
      details={error.detail}
      actions={
        <>
          <Button variant="contained" onClick={onRetry}>
            Retry
          </Button>
          {error.kind === 'session' || error.kind === 'network' ? (
            <Button
              variant="outlined"
              component="a"
              href={`https://${host}/`}
              target="_blank"
              rel="noreferrer"
            >
              Open Salesforce to sign in
            </Button>
          ) : null}
        </>
      }
    >
      {error.hint}
    </StatePanel>
  )
}

function EmptyList({ onRefresh, host }) {
  const dispatch = useDispatch()
  const logging = useSelector(state => state.logsPage.logging)
  return (
    <StatePanel
      icon={<InboxIcon />}
      title="No debug logs yet"
      actions={
        <>
          {logging.status === 'off' ? (
            <Button
              variant="contained"
              onClick={() => dispatch(startLogging())}
              disabled={logging.busy}
            >
              Start logging
            </Button>
          ) : null}
          <Button variant="outlined" onClick={onRefresh}>
            Refresh
          </Button>
        </>
      }
    >
      {logging.status === 'on'
        ? `Logging is on for you until ${formatClock(logging.expiresAt)}. Run something in Salesforce, then refresh.`
        : logging.status === 'off'
          ? 'Logging is off for you. Start logging, run something in Salesforce, then refresh.'
          : 'Run something in Salesforce while logging is on, then refresh.'}{' '}
      <Link
        href={`https://${host}/setup/ui/listApexTraces.apexp`}
        target="_blank"
        rel="noreferrer"
      >
        Debug logs in Salesforce
      </Link>
    </StatePanel>
  )
}

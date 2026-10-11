import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { Box, ButtonBase, Skeleton, Tooltip } from '@mui/material'
import SuccessIcon from '@mui/icons-material/CheckCircleOutlined'
import ErrorIcon from '@mui/icons-material/ErrorOutlined'
import UpIcon from '@mui/icons-material/ArrowUpward'
import DownIcon from '@mui/icons-material/ArrowDownward'
import { openLog } from '../../../hash-route'
import {
  formatBytes,
  formatDuration,
  formatFullTime,
  formatStartTime,
  isFailed,
  shortOperation
} from '../utils'
import { layout } from '../../../ui/tokens'

// Status as an icon plus text: green check for Success, red mark and the
// error for failed runs, so failures stand out without relying on color.
export function StatusLabel({ log, compact = false }) {
  const failed = isFailed(log)
  const Icon = failed ? ErrorIcon : SuccessIcon
  const label = failed ? log.Status : 'Success'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 0,
        maxWidth: '100%',
        color: failed ? 'error.main' : 'text.secondary',
        fontWeight: failed ? 600 : 400
      }}
    >
      <Icon
        sx={{
          fontSize: 16,
          color: failed ? 'error.main' : 'success.main',
          flex: 'none'
        }}
        aria-hidden
      />
      <Box
        component="span"
        title={label}
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        className={compact && !failed ? 'sr-only' : undefined}
      >
        {label}
      </Box>
    </Box>
  )
}

const COLUMNS = [
  { key: 'time', label: 'Time', sortable: true, width: 150 },
  { key: 'operation', label: 'Operation' },
  { key: 'status', label: 'Status', width: '22%' },
  { key: 'user', label: 'User', width: 150 },
  {
    key: 'duration',
    label: 'Duration',
    sortable: true,
    width: 100,
    align: 'right'
  },
  { key: 'size', label: 'Size', sortable: true, width: 90, align: 'right' },
  { key: 'matches', label: 'Matches', width: 90, align: 'right' }
]

// The log list as a grid: one Tab stop (the current row), ↑/↓ or j/k to
// move, Home/End, Enter to open (docs/ux/baseline-review.md B2). `compact`
// is the narrow list next to an opened log; otherwise a sortable table.
// The ref offers focusRow() and moveFocus(delta) for the page shortcuts.
const LogList = forwardRef(function LogList(
  { logs, openId, compact, sort, onSort, newIds, matches, showUser, loading },
  ref
) {
  const rowRefs = useRef([])
  const openIndex = logs.findIndex(log => log.Id === openId)
  const [active, setActive] = useState(Math.max(0, openIndex))
  const current = Math.min(active, Math.max(0, logs.length - 1))

  // Follow the opened log (e.g. [ and ] or the back button).
  useEffect(() => {
    if (openIndex >= 0) {
      setActive(openIndex)
      const row = rowRefs.current[openIndex]
      if (row) row.scrollIntoView({ block: 'nearest' })
    }
  }, [openIndex])

  const focusAt = index => {
    const i = Math.max(0, Math.min(logs.length - 1, index))
    setActive(i)
    const row = rowRefs.current[i]
    if (row) {
      row.focus()
      row.scrollIntoView({ block: 'nearest' })
    }
  }
  useImperativeHandle(ref, () => ({
    focusRow: () => focusAt(current),
    moveFocus: delta => {
      const focused = rowRefs.current.includes(document.activeElement)
      focusAt(focused ? current + delta : current)
    }
  }))

  const onKeyDown = (e, index) => {
    const moves = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key in moves) focusAt(index + moves[e.key])
    else if (e.key === 'Home') focusAt(0)
    else if (e.key === 'End') focusAt(logs.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') openLog(logs[index].Id)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const columns = COLUMNS.filter(
    c => (c.key !== 'user' || showUser) && (c.key !== 'matches' || matches)
  )

  const cell = {
    px: 1.5,
    py: 0.75,
    textAlign: 'left',
    fontWeight: 400,
    verticalAlign: 'middle'
  }
  const rows = logs.map((log, index) => {
    const isOpen = log.Id === openId
    const isNew = Boolean(newIds[log.Id])
    const start = formatStartTime(log.StartTime)
    const rowProps = {
      ref: el => (rowRefs.current[index] = el),
      role: 'row',
      tabIndex: index === current ? 0 : -1,
      'aria-selected': isOpen,
      'data-log-id': log.Id,
      onClick: () => {
        setActive(index)
        openLog(log.Id)
      },
      onKeyDown: e => onKeyDown(e, index),
      onFocus: () => setActive(index)
    }
    const newBadge = isNew ? (
      <Box
        component="span"
        sx={{
          ml: 1,
          px: 0.5,
          borderRadius: 1,
          fontSize: 11,
          fontWeight: 600,
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }}
      >
        New
      </Box>
    ) : null
    if (compact) {
      return (
        <Box component="tr" key={log.Id} {...rowProps} sx={rowSx(isOpen)}>
          <Box component="td" role="gridcell" sx={{ ...cell, py: 0.75 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0
              }}
            >
              <Box
                component="span"
                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                title={formatFullTime(log.StartTime)}
              >
                {start}
              </Box>
              {newBadge}
              <Box sx={{ flex: 1 }} />
              <StatusLabel log={log} compact />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                color: 'text.secondary',
                fontSize: 12,
                minWidth: 0
              }}
            >
              <Box
                component="span"
                title={log.Operation}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {shortOperation(log.Operation)}
              </Box>
              <span>{formatDuration(log.DurationMilliseconds)}</span>
              <span>{formatBytes(log.LogLength)}</span>
              {matches ? (
                <span>{plural(matches[log.Id] || 0, 'match', 'matches')}</span>
              ) : null}
            </Box>
          </Box>
        </Box>
      )
    }
    const values = {
      time: (
        <>
          <Box
            component="span"
            title={formatFullTime(log.StartTime)}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {start}
          </Box>
          {newBadge}
        </>
      ),
      operation: (
        <Tooltip title={log.Operation || ''} placement="bottom-start">
          <Box component="span" sx={ellipsis}>
            {shortOperation(log.Operation)}
          </Box>
        </Tooltip>
      ),
      status: <StatusLabel log={log} />,
      user: (
        <Box component="span" sx={ellipsis}>
          {log.LogUser && log.LogUser.Name}
        </Box>
      ),
      duration: formatDuration(log.DurationMilliseconds),
      size: formatBytes(log.LogLength),
      matches: matches ? matches[log.Id] || 0 : null
    }
    return (
      <Box component="tr" key={log.Id} {...rowProps} sx={rowSx(isOpen)}>
        {columns.map(c => (
          <Box
            component="td"
            role="gridcell"
            key={c.key}
            sx={{
              ...cell,
              textAlign: c.align || 'left',
              fontVariantNumeric: 'tabular-nums',
              maxWidth: 0
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
                minWidth: 0
              }}
            >
              {values[c.key]}
            </Box>
          </Box>
        ))}
      </Box>
    )
  })

  return (
    <Box
      component="table"
      role="grid"
      aria-label="Debug logs"
      aria-rowcount={logs.length}
      aria-busy={loading || undefined}
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: 13,
        color: 'text.primary'
      }}
    >
      {compact ? null : (
        <Box
          component="thead"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            bgcolor: 'background.paper'
          }}
        >
          <tr role="row">
            {columns.map(c => (
              <Box
                component="th"
                role="columnheader"
                key={c.key}
                scope="col"
                aria-sort={
                  c.sortable && sort.key === c.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                sx={{
                  ...cell,
                  width: c.width,
                  textAlign: c.align || 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'text.secondary',
                  borderBottom: 1,
                  borderColor: 'divider',
                  whiteSpace: 'nowrap'
                }}
              >
                {c.sortable ? (
                  <ButtonBase
                    onClick={() => onSort(c.key)}
                    sx={{
                      font: 'inherit',
                      color: sort.key === c.key ? 'text.primary' : 'inherit',
                      gap: 0.5,
                      borderRadius: 1,
                      px: 0.5,
                      mx: -0.5
                    }}
                  >
                    {c.label}
                    {sort.key === c.key ? (
                      sort.direction === 'asc' ? (
                        <UpIcon sx={{ fontSize: 14 }} aria-hidden />
                      ) : (
                        <DownIcon sx={{ fontSize: 14 }} aria-hidden />
                      )
                    ) : null}
                  </ButtonBase>
                ) : (
                  c.label
                )}
              </Box>
            ))}
          </tr>
        </Box>
      )}
      <tbody>{rows}</tbody>
    </Box>
  )
})

export default LogList

const ellipsis = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

const rowSx = isOpen => ({
  height: layout.rowHeight,
  cursor: 'pointer',
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: isOpen ? 'action.selected' : 'transparent',
  boxShadow: isOpen ? 'inset 3px 0 0 var(--ad-accent)' : 'none',
  '&:hover': { bgcolor: isOpen ? 'action.selected' : 'action.hover' },
  '&:focus-visible': { outline: '2px solid var(--ad-focus)', outlineOffset: -2 }
})

// Placeholder rows while the first list loads (no layout shift).
export function LogListSkeleton({ compact, rows = 10 }) {
  return (
    <Box aria-hidden sx={{ px: 1.5, py: 1 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            height: compact ? 48 : layout.rowHeight
          }}
        >
          <Skeleton variant="text" width={compact ? '35%' : 120} />
          {compact ? null : <Skeleton variant="text" sx={{ flex: 1 }} />}
          <Skeleton variant="text" width={compact ? '25%' : 90} />
        </Box>
      ))}
    </Box>
  )
}

import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  Typography
} from '@mui/material'
import ErrorIcon from '@mui/icons-material/ErrorOutlined'
import WarningIcon from '@mui/icons-material/WarningAmberOutlined'
import { fontFamily } from '../../../ui/tokens'
import {
  limitLevel,
  nextOccurrence,
  sortGroups
} from '../../../core/log/log-summary'

const number = new Intl.NumberFormat('en-US')
const formatMs = ms =>
  ms === null ? '–' : `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`

// A limit's level is told by its text and icon, not only by its color.
const LEVELS = {
  ok: { color: 'primary.main', text: null, icon: null },
  warning: { color: 'warning.main', text: 'over 70 %', icon: WarningIcon },
  critical: { color: 'error.main', text: 'over 90 %', icon: ErrorIcon }
}

// The log's summary (core/log/log-summary.ts) in tabs: errors, governor
// limits, SOQL and DML. Every entry jumps to its line in the log: onJump(line
// number); a SOQL or DML group goes to its next occurrence after activeLine on
// each click.
export default function LogSummaryPanel({ id, summary, activeLine, onJump }) {
  const tabs = [
    { key: 'errors', label: `Errors (${summary.issues.length})` },
    { key: 'limits', label: 'Limits' },
    { key: 'soql', label: `SOQL (${summary.soqlCount})` },
    { key: 'dml', label: `DML (${summary.dmlCount})` }
  ]
  const [tab, setTab] = useState(() =>
    summary.issues.length ? 'errors' : summary.limits.length ? 'limits' : 'soql'
  )
  // Announced to screen readers after each jump (focus stays on the entry,
  // so the next press goes to the next occurrence).
  const [status, setStatus] = useState('')
  const jump = line => {
    setStatus(`Showing log line ${line}`)
    onJump(line)
  }
  return (
    <Box
      id={id}
      component="section"
      aria-label="Log summary"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '45%',
        minHeight: 0,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        selectionFollowsFocus
        aria-label="Summary sections"
        sx={{ px: 2, minHeight: 36, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map(t => (
          <Tab
            key={t.key}
            value={t.key}
            label={t.label}
            id={`${id}-tab-${t.key}`}
            aria-controls={`${id}-panel`}
            sx={{ minHeight: 36, py: 0.5 }}
          />
        ))}
      </Tabs>
      <Box
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        sx={{ overflow: 'auto', minHeight: 0, px: 2, py: 1 }}
      >
        <span id={`${id}-jump-hint`} hidden>
          Goes to the next occurrence in the log.
        </span>
        {tab === 'errors' ? (
          <Errors summary={summary} onJump={jump} />
        ) : tab === 'limits' ? (
          <Limits limits={summary.limits} onJump={jump} />
        ) : tab === 'soql' ? (
          <Groups
            label="SOQL queries"
            groups={summary.soql}
            empty="No SOQL queries in this log."
            loopText="Possible query in loop"
            columns={[{ key: 'query', label: 'Query' }]}
            name={g => g.query}
            activeLine={activeLine}
            hintId={`${id}-jump-hint`}
            onJump={jump}
          />
        ) : (
          <Groups
            label="DML operations"
            groups={summary.dml}
            empty="No DML in this log."
            loopText="Possible DML in loop"
            columns={[
              { key: 'operation', label: 'Operation' },
              { key: 'object', label: 'Object' }
            ]}
            name={g => `${g.operation} ${g.object}`}
            activeLine={activeLine}
            hintId={`${id}-jump-hint`}
            onJump={jump}
          />
        )}
      </Box>
      <span className="sr-only" role="status">
        {status}
      </span>
    </Box>
  )
}

function Empty({ children }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
      {children}
    </Typography>
  )
}

function Errors({ summary, onJump }) {
  if (!summary.issues.length)
    return <Empty>No exceptions or fatal errors in this log.</Empty>
  return (
    <>
      <Box
        component="ul"
        aria-label="Exceptions and fatal errors"
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {summary.issues.map(issue => (
          <li key={issue.line}>
            <Button
              color="inherit"
              onClick={() => onJump(issue.line)}
              startIcon={<ErrorIcon color="error" aria-hidden />}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                fontWeight: 'normal',
                gap: 1
              }}
            >
              <Box component="span" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {issue.eventType === 'FATAL_ERROR'
                  ? 'Fatal error'
                  : 'Exception'}
              </Box>
              <Box
                component="span"
                sx={{ fontFamily: fontFamily.mono, wordBreak: 'break-word' }}
              >
                {issue.message}
              </Box>
              <Box
                component="span"
                sx={{ ml: 'auto', color: 'text.secondary', flexShrink: 0 }}
              >
                {issue.sourceLine !== null
                  ? `Apex line ${issue.sourceLine} · `
                  : ''}
                Log line {issue.line}
              </Box>
            </Button>
          </li>
        ))}
      </Box>
      {summary.issuesTruncated ? (
        <Empty>Only the first {summary.issues.length} errors are listed.</Empty>
      ) : null}
    </>
  )
}

function Limits({ limits, onJump }) {
  if (!limits.length)
    return (
      <Empty>
        This log has no limit usage (LIMIT_USAGE_FOR_NS). Log the APEX_PROFILING
        category at INFO or finer to get it.
      </Empty>
    )
  return limits.map(({ namespace, limits: usage }) => (
    <Box key={namespace} sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="h3" variant="h3">
          Namespace {namespace}
        </Typography>
        <Button
          onClick={() => onJump(usage[0].line)}
          aria-label={`Show in log: limits of ${namespace}`}
        >
          Show in log
        </Button>
      </Box>
      <Table size="small" aria-label={`Limits of ${namespace}`}>
        <TableHead>
          <TableRow>
            <TableCell>Limit</TableCell>
            <TableCell align="right">Used</TableCell>
            <TableCell sx={{ width: '35%' }}>Usage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {usage.map(limit => {
            const level = LEVELS[limitLevel(limit.used, limit.max)]
            const LevelIcon = level.icon
            const percent = limit.max
              ? Math.min(100, (limit.used / limit.max) * 100)
              : 0
            return (
              <TableRow
                key={limit.name}
                data-level={limitLevel(limit.used, limit.max)}
              >
                <TableCell component="th" scope="row">
                  {limit.name}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {number.format(limit.used)} / {number.format(limit.max)}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      role="meter"
                      aria-label={limit.name}
                      aria-valuemin={0}
                      aria-valuemax={limit.max}
                      aria-valuenow={limit.used}
                      aria-valuetext={`${Math.round(percent)} %${level.text ? `, ${level.text}` : ''}`}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'action.hover',
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          width: `${percent}%`,
                          height: '100%',
                          bgcolor: level.color
                        }}
                      />
                    </Box>
                    <Box
                      component="span"
                      aria-hidden
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 136,
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        fontWeight: level.text ? 600 : 'normal',
                        color: level.text ? level.color : 'text.secondary'
                      }}
                    >
                      {LevelIcon ? (
                        <LevelIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <Box component="span" sx={{ width: 16 }} />
                      )}
                      {Math.round(percent)} %
                      {level.text ? ` · ${level.text}` : ''}
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  ))
}

const SORTABLE = [
  { key: 'count', label: 'Count' },
  { key: 'rows', label: 'Rows' },
  { key: 'timeMs', label: 'Time' }
]

function Groups({
  label,
  groups,
  empty,
  loopText,
  columns,
  name,
  activeLine,
  hintId,
  onJump
}) {
  const [sort, setSort] = useState({ key: 'count', direction: 'desc' })
  const sorted = useMemo(
    () => sortGroups(groups, sort.key, sort.direction),
    [groups, sort]
  )
  if (!groups.length) return <Empty>{empty}</Empty>
  const sortBy = key =>
    setSort(s => ({
      key,
      direction: s.key === key && s.direction === 'desc' ? 'asc' : 'desc'
    }))
  return (
    <Table size="small" aria-label={label}>
      <TableHead>
        <TableRow>
          {columns.map(c => (
            <TableCell key={c.key}>{c.label}</TableCell>
          ))}
          {SORTABLE.map(c => (
            <TableCell
              key={c.key}
              align="right"
              sortDirection={sort.key === c.key ? sort.direction : false}
            >
              <TableSortLabel
                active={sort.key === c.key}
                direction={sort.key === c.key ? sort.direction : 'desc'}
                onClick={() => sortBy(c.key)}
              >
                {c.label}
              </TableSortLabel>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.map(group => {
          const key = group.lines[0]
          const jump = () => onJump(nextOccurrence(group.lines, activeLine))
          return (
            <TableRow key={key} data-count={group.count}>
              {columns.map((c, i) => (
                <TableCell
                  key={c.key}
                  sx={{ fontFamily: fontFamily.mono, fontSize: 12 }}
                >
                  {i === 0 ? (
                    <Button
                      color="inherit"
                      onClick={jump}
                      aria-label={name(group)}
                      aria-describedby={group.count > 1 ? hintId : undefined}
                      title={
                        group.count > 1
                          ? 'Go to the next occurrence in the log'
                          : 'Go to it in the log'
                      }
                      sx={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'normal',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        wordBreak: 'break-word',
                        px: 0.5,
                        minHeight: 0
                      }}
                    >
                      {group[c.key]}
                    </Button>
                  ) : (
                    group[c.key]
                  )}
                  {i === 0 && group.possibleLoop ? (
                    <LoopHint>{loopText}</LoopHint>
                  ) : null}
                </TableCell>
              ))}
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {number.format(group.count)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {number.format(group.rows)}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatMs(group.timeMs)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// A badge on a group that ran many times from the same line: text and icon,
// not only color.
function LoopHint({ children }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ml: 1,
        px: 0.75,
        border: 1,
        borderColor: 'warning.main',
        borderRadius: 1,
        color: 'warning.main',
        fontFamily: fontFamily.ui,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle'
      }}
    >
      <WarningIcon aria-hidden sx={{ fontSize: 14 }} />
      {children}
    </Box>
  )
}

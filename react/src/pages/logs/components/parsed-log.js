import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box } from '@mui/material'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandIcon from '@mui/icons-material/ChevronRight'
import globalSf from '../../../global-sf'
import {
  canBeautify,
  indentUserDebug,
  splitUserDebug
} from '../../../core/log/parsing'
import { segments } from '../../../core/log/log-lines'
import { LOG_CATEGORIES } from '../../../core/log/categories'
import { fontFamily } from '../../../ui/tokens'

// Logs with up to this many lines are rendered whole, so the browser's find
// (Ctrl+F) sees every line. Longer ones (a log can have 20 MB) render only
// the lines near the visible part, plus OVERSCAN lines around it.
export const RENDER_ALL_UP_TO = 2000
const OVERSCAN = 30

// Each line's colors and fonts come from the palette's CSS custom properties
// (themeCssVariables, set on the <pre> by the viewer), per category class.
const categoryRules = Object.fromEntries(
  LOG_CATEGORIES.map(c => [
    `& .cat-${c}`,
    {
      color: `var(--log-${c}-color)`,
      fontWeight: `var(--log-${c}-weight)`,
      fontStyle: `var(--log-${c}-style)`
    }
  ])
)

// The log body: the header, then one line per entry, each with a gutter
// (line number, error marker), a muted time, the event type and the message
// in its category's color. Salesforce ids are links; find matches are
// marked. `lines` are the visible lines (core/log/log-lines.ts).
// The ref offers scrollToRow(row) (centered).
const ParsedLog = forwardRef(function ParsedLog(
  {
    lines,
    fontSize,
    textWrap,
    scrollElement,
    term,
    matchRows,
    currentMatch,
    activeRow,
    expandAll
  },
  ref
) {
  // Rows the user toggled (relative to expandAll); kept here rather than in
  // the lines, which unmount when scrolled away.
  const [toggled, setToggled] = useState(() => ({
    lines,
    expandAll,
    set: new Set()
  }))
  const toggledSet =
    toggled.lines === lines && toggled.expandAll === expandAll
      ? toggled.set
      : null
  const toggle = useCallback(
    row =>
      setToggled(prev => {
        const set = new Set(
          prev.lines === lines && prev.expandAll === expandAll ? prev.set : []
        )
        if (set.has(row)) set.delete(row)
        else set.add(row)
        return { lines, expandAll, set }
      }),
    [lines, expandAll]
  )

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => Math.ceil(fontSize * 1.45) + 2,
    overscan: lines.length <= RENDER_ALL_UP_TO ? lines.length : OVERSCAN,
    getItemKey: index => lines[index].number
  })
  // Line heights change with the font size and wrapping.
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, fontSize, textWrap])

  useImperativeHandle(
    ref,
    () => ({
      scrollToRow: row => {
        if (row >= 0 && row < lines.length)
          virtualizer.scrollToIndex(row, { align: 'center' })
      }
    }),
    [virtualizer, lines.length]
  )

  // Marker or toggle, then the line number.
  const digits = String(
    lines.length ? lines[lines.length - 1].number : 0
  ).length
  const gutterWidth = `calc(${digits + 2}ch + 1.3em)`
  const sx = useMemo(
    () => ({
      m: 0,
      fontFamily: fontFamily.mono,
      fontVariantLigatures: 'none',
      lineHeight: 1.45,
      tabSize: 4,
      minWidth: textWrap ? 0 : 'max-content',
      '& > div': {
        display: 'grid',
        gridTemplateColumns: `${gutterWidth} 1fr`,
        whiteSpace: textWrap ? 'pre-wrap' : 'pre',
        overflowWrap: textWrap ? 'anywhere' : 'normal',
        pr: 2
      },
      '& .gutter': {
        position: 'sticky',
        left: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        whiteSpace: 'nowrap',
        fontWeight: 400,
        fontStyle: 'normal',
        pr: '1ch',
        mr: '1ch',
        color: 'var(--log-muted)',
        backgroundColor: 'var(--log-background)',
        userSelect: 'none',
        borderRight:
          '1px solid color-mix(in srgb, var(--log-muted) 35%, transparent)'
      },
      '& .gutter::after': {
        content: 'attr(data-line)',
        fontVariantNumeric: 'tabular-nums'
      },
      '& .slot': {
        display: 'inline-flex',
        width: '1.3em',
        height: '1.45em',
        alignItems: 'center',
        justifyContent: 'center'
      },
      '& .marker': { fontSize: '1.05em', color: 'var(--log-error-color)' },
      '& .t': {
        color: 'var(--log-muted)',
        fontWeight: 400,
        fontStyle: 'normal'
      },
      '& a': {
        color: 'inherit',
        textDecorationThickness: '1px',
        textUnderlineOffset: '2px'
      },
      '& mark': {
        backgroundColor: '#fff0a8',
        color: '#1b1f24',
        borderRadius: '2px'
      },
      '& mark.current': {
        backgroundColor: '#ffb84d',
        outline: '2px solid #1b1f24',
        outlineOffset: '0'
      },
      '& .is-active .gutter': {
        color: 'var(--log-rest-color)',
        fontWeight: 700,
        boxShadow: 'inset 3px 0 0 var(--log-rest-color)'
      },
      '& .toggle': {
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        verticalAlign: 'top',
        width: '1.2em',
        height: '1.45em',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--log-rest-color)',
        borderRadius: '3px',
        '& svg': { fontSize: '1.1em', transition: 'transform 120ms' },
        '&[aria-expanded="true"] svg': { transform: 'rotate(90deg)' },
        '&:focus-visible': { outline: '2px solid var(--ad-focus)' },
        '&:hover': {
          backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)'
        }
      },
      ...categoryRules
    }),
    [gutterWidth, textWrap]
  )

  if (lines.length === 0) return null
  const items = virtualizer.getVirtualItems()
  const first = items.length ? items[0].start : 0
  const last = items.length ? items[items.length - 1].end : 0
  return (
    <Box
      component="pre"
      sx={sx}
      style={{
        fontSize,
        paddingTop: first + 4,
        paddingBottom: Math.max(0, virtualizer.getTotalSize() - last) + 16
      }}
    >
      {items.map(item => {
        const row = item.index
        const expanded =
          expandAll !== Boolean(toggledSet && toggledSet.has(row))
        const hasMatch = matchRows.has(row)
        return (
          <LogLine
            key={item.key}
            row={row}
            line={lines[row]}
            measureRef={virtualizer.measureElement}
            expanded={expanded}
            onToggle={toggle}
            term={hasMatch ? term : ''}
            currentNth={
              currentMatch && currentMatch.row === row ? currentMatch.nth : -1
            }
            active={activeRow === row}
          />
        )
      })}
    </Box>
  )
})

export default ParsedLog

function LineText({ text, term, currentNth }) {
  return segments(text, term).map((segment, i) => {
    let content = segment.text
    if (segment.match !== undefined) {
      content = (
        <mark
          className={segment.match === currentNth ? 'current' : undefined}
          data-match={segment.match}
        >
          {content}
        </mark>
      )
    }
    if (segment.id) {
      content = (
        <a
          href={`https://${globalSf.hostname}/${segment.id}`}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
        >
          {content}
        </a>
      )
    }
    const className =
      segment.part === 'time' ? 't' : segment.part === 'event' ? 'ev' : 'msg'
    return (
      <span className={className} key={i}>
        {content}
      </span>
    )
  })
}

const LogLine = memo(function LogLine({
  row,
  line,
  measureRef,
  expanded,
  onToggle,
  term,
  currentNth,
  active
}) {
  const isDebug = line.eventType === 'USER_DEBUG'
  const parsed = isDebug ? splitUserDebug(line.text) : null
  const expandable = Boolean(parsed && canBeautify(parsed.message))
  const shown = expandable && expanded ? indentUserDebug(line.text) : line.text
  const isError = line.category === 'error'
  const className = `cat-${line.category}${active ? ' is-active' : ''}`
  return (
    <div
      ref={measureRef}
      data-index={row}
      data-line={line.number}
      data-category={line.category}
      className={className}
    >
      <span className="gutter" data-line={line.number || ''}>
        <span className="slot">
          {isError ? (
            <ErrorIcon className="marker" role="img" aria-label="Error" />
          ) : null}
          {expandable ? (
            <button
              type="button"
              className="toggle"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse value' : 'Expand value'}
              onClick={() => onToggle(row)}
            >
              <ExpandIcon aria-hidden />
            </button>
          ) : null}
        </span>
      </span>
      <span>
        <LineText text={shown} term={term} currentNth={currentNth} />
      </span>
    </div>
  )
})

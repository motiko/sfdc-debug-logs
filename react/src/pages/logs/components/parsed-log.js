import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useVirtualizer } from '@tanstack/react-virtual'
import { IconButton } from '@mui/material'
import AddIcon from '@mui/icons-material/AddCircle'
import RemoveIcon from '@mui/icons-material/RemoveCircle'
import globalSf from '../../../global-sf'
import {
  splitLog,
  filterEntries,
  eventTypeOf,
  eventCategory,
  splitIds,
  indentUserDebug
} from '../../../core/log/parsing'
import { themeByName } from '../../../core/log/themes'

// Logs with up to this many entries are rendered whole, so the browser's
// find (Ctrl+F) sees every line. Longer ones (a log can have 20 MB) render
// only the lines near the visible part, plus OVERSCAN lines around it.
export const RENDER_ALL_UP_TO = 2000
const OVERSCAN = 30

// A category's style: the color from the (possibly user-edited) theme, the
// font weight and style from the theme's definition.
function categoryStyle(logTheme, category) {
  const { fontWeight, fontStyle } =
    themeByName(logTheme.themeName).categories[category] || {}
  return {
    color: logTheme[category],
    fontWeight: fontWeight || 'normal',
    fontStyle: fontStyle || 'normal'
  }
}

const lineStyle = { marginLeft: '0.6em', paddingTop: '0.6em' }

// The log body: the header lines, then one line per entry (of the event
// types picked in the contents filter, if any), colored by category.
// scrollElement is the element that scrolls the log.
export default function ParsedLog({ body, styleConfig, scrollElement }) {
  const visibleEvents = useSelector(state => state.logsPage.visibleEvents)
  const lines = useMemo(() => {
    if (!body) return []
    const { intro, entries } = splitLog(body)
    return [intro || '', ...filterEntries(entries, visibleEvents)]
  }, [body, visibleEvents])
  // Indexes of the USER_DEBUG lines shown beautified; kept here rather than
  // in the lines, which unmount when scrolled away.
  const [expanded, setExpanded] = useState(() => ({ lines, set: new Set() }))
  const expandedSet = expanded.lines === lines ? expanded.set : null
  const toggle = useCallback(
    index =>
      setExpanded(prev => {
        const set = new Set(prev.lines === lines ? prev.set : [])
        if (set.has(index)) set.delete(index)
        else set.add(index)
        return { lines, set }
      }),
    [lines]
  )

  const { fontSize, textWrap, theme } = styleConfig
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => Math.ceil(fontSize * 2),
    overscan: lines.length <= RENDER_ALL_UP_TO ? lines.length : OVERSCAN
  })
  // Line heights change with the font size and wrapping.
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, fontSize, textWrap])

  if (lines.length === 0) return <div />
  const items = virtualizer.getVirtualItems()
  const first = items.length ? items[0].start : 0
  const last = items.length ? items[items.length - 1].end : 0
  return (
    <pre
      style={{
        margin: 0,
        marginLeft: '20px',
        paddingTop: first,
        paddingBottom: Math.max(0, virtualizer.getTotalSize() - last),
        lineHeight: '140%',
        fontFamily: "'Courier New', 'Courier', mono",
        fontSize,
        whiteSpace: textWrap ? 'pre-wrap' : 'pre',
        overflowWrap: textWrap ? 'break-word' : 'normal'
      }}
    >
      {items.map(item => (
        <LogLine
          key={item.index}
          index={item.index}
          measureRef={virtualizer.measureElement}
          text={lines[item.index]}
          isIntro={item.index === 0}
          logTheme={theme}
          indented={Boolean(expandedSet && expandedSet.has(item.index))}
          onToggle={toggle}
        />
      ))}
    </pre>
  )
}

// Turns Salesforce ids into links and keeps all text around them.
function withLinks(text, color) {
  const parts = splitIds(text)
  if (parts.every(part => typeof part === 'string')) return text
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      part
    ) : (
      <a
        href={`https://${globalSf.hostname}/${part.id}`}
        style={{ color }}
        key={index}
      >
        {part.id}
      </a>
    )
  )
}

const LogLine = memo(function LogLine({
  index,
  measureRef,
  text,
  isIntro,
  logTheme,
  indented,
  onToggle
}) {
  if (isIntro) {
    return (
      <div
        ref={measureRef}
        data-index={index}
        style={{ ...lineStyle, ...categoryStyle(logTheme, 'system') }}
      >
        {text}
      </div>
    )
  }
  const eventType = eventTypeOf(text)
  if (eventType === null) {
    console.error(`Didn't find event type for ${text} `)
    return <div ref={measureRef} data-index={index} />
  }
  const category = eventCategory(eventType)
  const isUserDebug = eventType === 'USER_DEBUG'
  const shown = isUserDebug && indented ? indentUserDebug(text) : text
  return (
    <div
      ref={measureRef}
      data-index={index}
      style={{ ...lineStyle, ...categoryStyle(logTheme, category) }}
    >
      {isUserDebug ? (
        <IconButton
          color="inherit"
          aria-label={indented ? 'Collapse' : 'Expand'}
          aria-expanded={indented}
          onClick={() => onToggle(index)}
          sx={{ m: 0, p: '0 12px', height: '1.5em', top: '0.2em' }}
          style={{ color: logTheme.rest }}
        >
          {indented ? <RemoveIcon /> : <AddIcon />}
        </IconButton>
      ) : null}
      {withLinks(shown, logTheme[category])}
    </div>
  )
})

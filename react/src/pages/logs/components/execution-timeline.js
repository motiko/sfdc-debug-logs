import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import ResetIcon from '@mui/icons-material/ZoomOutMap'
import IconAction from '../../../ui/components/icon-action'
import {
  formatNanos,
  timelineBars,
  UNIT_KIND_LABELS
} from '../../../core/log/execution-tree'
import { eventCategory } from '../../../core/log/categories'
import { fontFamily } from '../../../ui/tokens'

const ROW_HEIGHT = 20
const AXIS_HEIGHT = 22
// The narrowest window (ns) zooming in reaches.
const MIN_SPAN = 2000
const ZOOM_STEP = 1.6

// The timeline: the call tree (core/log/execution-tree.ts) as a flame chart
// over the log's nanosecond timestamps, one row per nesting level, colored
// by the log palette's categories. Drawn on a canvas with only the bars
// wide enough to see, so a 20 MB log stays fast. Hovering shows a unit's
// details; a click goes to its line in the log, a double click zooms to it.
// Zoom with the buttons, Ctrl/Cmd+wheel or +/- (0 resets); pan with
// Shift+wheel or Left/Right. The call tree has the same units for keyboard
// and screen reader users.
export default function ExecutionTimeline({ tree, theme, onJump }) {
  const scrollRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)
  const [view, setView] = useState({ from: tree.start, to: tree.end })
  const [hover, setHover] = useState(null)

  const full = Math.max(1, tree.end - tree.start)
  const clampView = useCallback(
    (from, to) => {
      let span = Math.min(full, Math.max(MIN_SPAN, to - from))
      if (span > full) span = full
      const start = Math.min(
        tree.end - span,
        Math.max(tree.start, from + (to - from - span) / 2)
      )
      return { from: start, to: start + span }
    },
    [full, tree.start, tree.end]
  )
  const zoom = useCallback(
    (factor, anchor = 0.5) =>
      setView(v => {
        const span = v.to - v.from
        const at = v.from + span * anchor
        const next = span / factor
        return clampView(at - next * anchor, at + next * (1 - anchor))
      }),
    [clampView]
  )
  const pan = useCallback(
    fraction =>
      setView(v => {
        const shift = (v.to - v.from) * fraction
        return clampView(v.from + shift, v.to + shift)
      }),
    [clampView]
  )
  const reset = () => setView({ from: tree.start, to: tree.end })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight })
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Ctrl/Cmd+wheel zooms at the pointer, Shift+wheel (or a sideways wheel)
  // pans; a plain wheel scrolls the levels. Needs a non-passive listener.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const anchor =
          (e.clientX - el.getBoundingClientRect().left) / el.clientWidth
        zoom(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, anchor)
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        const delta = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
        pan(delta / Math.max(1, el.clientWidth))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, pan])

  const bars = useMemo(
    () => timelineBars(tree.roots, view.from, view.to, size.width),
    [tree, view, size.width]
  )

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width || !size.height) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.font = `12px ${fontFamily.mono}`
    ctx.textBaseline = 'middle'
    const charWidth = ctx.measureText('M').width || 7
    const textColor = theme.categories.rest.color

    for (const bar of bars) {
      const y = AXIS_HEIGHT + bar.node.depth * ROW_HEIGHT - scrollTop
      if (y + ROW_HEIGHT < AXIS_HEIGHT || y > size.height) continue
      const color = theme.categories[eventCategory(bar.node.event)].color
      const x = Math.max(0, bar.x)
      const width = Math.min(size.width, bar.x + bar.width) - x
      ctx.fillStyle = color
      ctx.globalAlpha = 0.3
      ctx.fillRect(x, y + 1, Math.max(1, width - 1), ROW_HEIGHT - 2)
      ctx.globalAlpha = 1
      ctx.fillRect(x, y + 1, Math.min(2, width), ROW_HEIGHT - 2)
      const chars = Math.floor((width - 8) / charWidth)
      if (chars >= 3) {
        const name = bar.node.name
        ctx.fillStyle = textColor
        ctx.fillText(
          name.length > chars ? `${name.slice(0, chars - 1)}…` : name,
          x + 5,
          y + ROW_HEIGHT / 2
        )
      }
      if (hover && hover.node === bar.node) {
        ctx.strokeStyle = textColor
        ctx.lineWidth = 2
        ctx.strokeRect(x + 1, y + 1, Math.max(1, width - 2), ROW_HEIGHT - 2)
      }
    }

    // Time axis (over the bars when scrolled).
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, size.width, AXIS_HEIGHT)
    ctx.fillStyle = theme.muted
    ctx.fillRect(0, AXIS_HEIGHT - 1, size.width, 1)
    const span = view.to - view.from
    const step = niceStep(span / Math.max(1, size.width / 110))
    const first = Math.ceil((view.from - tree.start) / step) * step
    ctx.font = `11px ${fontFamily.ui}`
    for (let t = first; t <= view.to - tree.start; t += step) {
      const x = ((t + tree.start - view.from) / span) * size.width
      ctx.fillRect(x, AXIS_HEIGHT - 6, 1, 5)
      ctx.fillText(formatNanos(t), x + 3, AXIS_HEIGHT / 2 - 1)
    }
  }, [bars, size, scrollTop, theme, hover, view, tree.start])

  const hitTest = e => {
    const el = scrollRef.current
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (y < AXIS_HEIGHT) return null
    const depth = Math.floor((y - AXIS_HEIGHT + scrollTop) / ROW_HEIGHT)
    const bar = bars.find(
      b => b.node.depth === depth && x >= b.x && x <= b.x + Math.max(1, b.width)
    )
    return bar ? { node: bar.node, x, y } : null
  }

  const onKeyDown = e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === '+' || e.key === '=') zoom(ZOOM_STEP)
    else if (e.key === '-') zoom(1 / ZOOM_STEP)
    else if (e.key === '0') reset()
    else if (e.key === 'ArrowLeft') pan(-0.2)
    else if (e.key === 'ArrowRight') pan(0.2)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const zoomed = view.from > tree.start || view.to < tree.end
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          py: 0.25,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          role="status"
          data-testid="timeline-window"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {zoomed
            ? `${formatNanos(view.from - tree.start)} – ${formatNanos(view.to - tree.start)} of ${formatNanos(full)}`
            : `Whole run: ${formatNanos(full)}`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconAction
          label="Zoom in"
          shortcut="+"
          icon={<ZoomInIcon />}
          onClick={() => zoom(ZOOM_STEP)}
          disabled={view.to - view.from <= MIN_SPAN}
        />
        <IconAction
          label="Zoom out"
          shortcut="-"
          icon={<ZoomOutIcon />}
          onClick={() => zoom(1 / ZOOM_STEP)}
          disabled={!zoomed}
        />
        <IconAction
          label="Show the whole run"
          shortcut="0"
          icon={<ResetIcon />}
          onClick={reset}
          disabled={!zoomed}
        />
      </Box>
      <Box
        sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}
      >
        <Box
          ref={scrollRef}
          role="group"
          aria-label="Timeline"
          aria-describedby="timeline-help"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
          onMouseMove={e => setHover(hitTest(e))}
          onMouseLeave={() => setHover(null)}
          onClick={e => {
            const hit = hitTest(e)
            if (hit) onJump(hit.node.line)
          }}
          onDoubleClick={e => {
            const hit = hitTest(e)
            if (hit) setView(clampView(hit.node.start, hit.node.end))
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            cursor: hover ? 'pointer' : 'default',
            backgroundColor: theme.background,
            '&:focus-visible': {
              outline: '2px solid var(--ad-focus)',
              outlineOffset: -2
            }
          }}
        >
          <Box
            sx={{
              height: AXIS_HEIGHT + (tree.maxDepth + 1) * ROW_HEIGHT + 8,
              minHeight: '100%'
            }}
          >
            <canvas
              ref={canvasRef}
              aria-hidden
              data-testid="timeline-canvas"
              style={{
                position: 'sticky',
                top: 0,
                display: 'block',
                width: size.width,
                height: size.height
              }}
            />
          </Box>
        </Box>
        {hover ? <HoverCard hit={hover} /> : null}
      </Box>
      <span id="timeline-help" className="sr-only">
        A flame chart of the call tree. Plus and minus zoom, 0 shows the whole
        run, Left and Right pan. Use the call tree to reach each unit with the
        keyboard.
      </span>
    </Box>
  )
}

function HoverCard({ hit }) {
  const { node } = hit
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: Math.max(8, hit.x + 12),
        top: hit.y + 16,
        maxWidth: 420,
        p: 1,
        pointerEvents: 'none',
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        fontSize: 12,
        zIndex: 2
      }}
    >
      <Box sx={{ color: 'text.secondary' }}>{UNIT_KIND_LABELS[node.kind]}</Box>
      <Box
        sx={{
          fontFamily: fontFamily.mono,
          wordBreak: 'break-word',
          mb: 0.5
        }}
      >
        {node.name}
      </Box>
      <Box>
        Total {formatNanos(node.total)} · Self {formatNanos(node.self)}
        {node.soql ? ` · ${node.soql} SOQL` : ''}
        {node.dml ? ` · ${node.dml} DML` : ''}
      </Box>
      <Box sx={{ color: 'text.secondary' }}>
        Line {node.line}
        {node.unclosed ? ' · no end in the log' : ''} · click to go there
      </Box>
    </Box>
  )
}

// A round step (1, 2 or 5 × 10^n) at least `raw` long.
function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, raw)))
  for (const m of [1, 2, 5, 10]) if (power * m >= raw) return power * m
  return power * 10
}

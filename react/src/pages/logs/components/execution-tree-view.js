import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Button, Typography } from '@mui/material'
import ExpandIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import {
  allExpandable,
  describeNode,
  expandedToDepth,
  formatNanos,
  UNIT_KIND_LABELS,
  visibleNodes
} from '../../../core/log/execution-tree'
import { fontFamily } from '../../../ui/tokens'

const ROW_HEIGHT = 28
const INDENT = 16
// Levels open when a log's tree is first shown.
const INITIAL_DEPTH = 3
const COLUMNS = 'minmax(0, 1fr) 96px 88px 56px 56px 72px'

// The call tree (core/log/execution-tree.ts): one row per unit, nested as
// called, with total and own time, SOQL and DML counts and the log line.
// An ARIA treeview with one Tab stop (aria-activedescendant): Up/Down move,
// Right opens or goes to the first child, Left closes or goes to the parent,
// Home/End, Page Up/Down, Enter (or a double click, or the line number) goes
// to the unit's line in the log. Rows are virtualized, and only open units'
// children are listed, so a 20 MB log's tree stays responsive.
export default function ExecutionTreeView({ tree, onJump }) {
  const [expanded, setExpanded] = useState(() =>
    expandedToDepth(tree, INITIAL_DEPTH)
  )
  const [activeId, setActiveId] = useState(() =>
    tree.roots.length ? tree.roots[0].id : -1
  )
  const scrollRef = useRef(null)
  const rows = useMemo(
    () => visibleNodes(tree.roots, expanded),
    [tree, expanded]
  )
  const rowOf = useMemo(() => {
    const map = new Map()
    rows.forEach((node, i) => map.set(node.id, i))
    return map
  }, [rows])
  const activeRow = rowOf.has(activeId) ? rowOf.get(activeId) : 0
  // The longest root, for each row's share-of-time bar.
  const longest = useMemo(
    () => tree.roots.reduce((max, r) => Math.max(max, r.total), 1),
    [tree]
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })
  // Keep the active row rendered (and in view) so aria-activedescendant
  // points at an element.
  useEffect(() => {
    if (rows.length) virtualizer.scrollToIndex(activeRow, { align: 'auto' })
  }, [virtualizer, activeRow, rows.length])

  const setOpen = (node, open) =>
    setExpanded(prev => {
      if (prev.has(node.id) === open) return prev
      const next = new Set(prev)
      if (open) next.add(node.id)
      else next.delete(node.id)
      return next
    })
  const moveTo = row => {
    if (!rows.length) return
    setActiveId(rows[Math.max(0, Math.min(rows.length - 1, row))].id)
  }

  const onKeyDown = e => {
    if (e.altKey || e.ctrlKey || e.metaKey || !rows.length) return
    const node = rows[activeRow]
    const page = Math.max(
      1,
      Math.floor((scrollRef.current?.clientHeight || 0) / ROW_HEIGHT) - 1
    )
    const open = node.children.length > 0 && expanded.has(node.id)
    switch (e.key) {
      case 'ArrowDown':
        moveTo(activeRow + 1)
        break
      case 'ArrowUp':
        moveTo(activeRow - 1)
        break
      case 'PageDown':
        moveTo(activeRow + page)
        break
      case 'PageUp':
        moveTo(activeRow - page)
        break
      case 'Home':
        moveTo(0)
        break
      case 'End':
        moveTo(rows.length - 1)
        break
      case 'ArrowRight':
        if (!node.children.length) return
        if (open) setActiveId(node.children[0].id)
        else setOpen(node, true)
        break
      case 'ArrowLeft':
        if (open) setOpen(node, false)
        else if (node.parent) setActiveId(node.parent.id)
        else return
        break
      case 'Enter':
        onJump(node.line)
        break
      case '*':
        // Opens the active unit's siblings (WAI-ARIA treeview).
        setExpanded(prev => {
          const next = new Set(prev)
          for (const sibling of node.parent ? node.parent.children : tree.roots)
            if (sibling.children.length) next.add(sibling.id)
          return next
        })
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const items = virtualizer.getVirtualItems()
  const units = tree.nodes.length
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="tree-summary"
        >
          {units
            ? `${units.toLocaleString()} ${units === 1 ? 'unit' : 'units'} · ${formatNanos(tree.end - tree.start)}`
            : 'No units'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="text"
          color="inherit"
          startIcon={<UnfoldMoreIcon />}
          onClick={() => setExpanded(allExpandable(tree))}
          disabled={!units}
        >
          Expand all
        </Button>
        <Button
          variant="text"
          color="inherit"
          startIcon={<UnfoldLessIcon />}
          onClick={() => {
            setExpanded(new Set())
            const root = rows[activeRow]
            let top = root
            while (top && top.parent) top = top.parent
            if (top) setActiveId(top.id)
          }}
          disabled={!units}
        >
          Collapse all
        </Button>
      </Box>
      {units === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          This log has no code units, methods, queries or DML to show. Logs list
          methods when the Apex Code log level is Fine or finer.
        </Typography>
      ) : (
        <>
          {/* Column labels; each row's accessible name says the same. */}
          <Box
            aria-hidden
            sx={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              px: 2,
              py: 0.5,
              fontSize: 12,
              fontWeight: 600,
              color: 'text.secondary',
              borderBottom: 1,
              borderColor: 'divider',
              '& > :not(:first-of-type)': { textAlign: 'right' }
            }}
          >
            <span>Unit</span>
            <span>Total</span>
            <span>Self</span>
            <span>SOQL</span>
            <span>DML</span>
            <span>Line</span>
          </Box>
          <Box
            ref={scrollRef}
            role="tree"
            aria-label="Call tree"
            aria-activedescendant={
              rows.length ? `exec-node-${rows[activeRow].id}` : undefined
            }
            tabIndex={0}
            onKeyDown={onKeyDown}
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              position: 'relative',
              outline: 'none',
              // The focus ring is on the active row.
              '&:focus-visible [aria-selected="true"]': {
                outline: '2px solid var(--ad-focus)',
                outlineOffset: -2
              }
            }}
          >
            <Box
              sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
              {items.map(item => {
                const node = rows[item.index]
                const siblings = node.parent ? node.parent.children : tree.roots
                return (
                  <TreeRow
                    key={node.id}
                    node={node}
                    top={item.start}
                    open={expanded.has(node.id)}
                    active={item.index === activeRow}
                    setSize={siblings.length}
                    position={node.position}
                    share={node.total / longest}
                    onSelect={() => {
                      setActiveId(node.id)
                      scrollRef.current && scrollRef.current.focus()
                    }}
                    onToggle={() => setOpen(node, !expanded.has(node.id))}
                    onJump={() => onJump(node.line)}
                  />
                )
              })}
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}

function TreeRow({
  node,
  top,
  open,
  active,
  setSize,
  position,
  share,
  onSelect,
  onToggle,
  onJump
}) {
  const hasChildren = node.children.length > 0
  const kindLabel = UNIT_KIND_LABELS[node.kind]
  const pct = `${Math.round(Math.min(1, share) * 100)}%`
  return (
    <Box
      role="treeitem"
      id={`exec-node-${node.id}`}
      aria-level={node.depth + 1}
      aria-setsize={setSize}
      aria-posinset={position}
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={active}
      aria-label={describeNode(node)}
      data-line={node.line}
      onClick={onSelect}
      onDoubleClick={onJump}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: ROW_HEIGHT,
        transform: `translateY(${top}px)`,
        display: 'grid',
        gridTemplateColumns: COLUMNS,
        alignItems: 'center',
        px: 2,
        fontSize: 13,
        cursor: 'default',
        bgcolor: active ? 'action.selected' : undefined,
        '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' },
        '& .num': {
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap'
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          pl: `${node.depth * INDENT}px`
        }}
      >
        <Box
          component="span"
          aria-hidden
          onClick={
            hasChildren
              ? e => {
                  e.stopPropagation()
                  onSelect()
                  onToggle()
                }
              : undefined
          }
          sx={{
            flex: 'none',
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasChildren ? 'pointer' : 'default',
            borderRadius: 1,
            visibility: hasChildren ? 'visible' : 'hidden',
            '& svg': {
              fontSize: 18,
              transform: open ? 'rotate(90deg)' : 'none'
            },
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <ExpandIcon />
        </Box>
        <Box
          component="span"
          sx={{
            flex: 'none',
            mx: 0.75,
            fontSize: 12,
            color: 'text.secondary'
          }}
        >
          {kindLabel === node.name ? null : kindLabel}
        </Box>
        <Box
          component="span"
          title={node.name}
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: fontFamily.mono,
            fontSize: 12.5
          }}
        >
          {node.name}
        </Box>
        {node.unclosed ? (
          <Box
            component="span"
            title="The log has no end entry for this unit (truncated or unbalanced log)"
            sx={{ flex: 'none', ml: 1, fontSize: 12, color: 'warning.main' }}
          >
            no end
          </Box>
        ) : null}
      </Box>
      <span
        className="num"
        style={{
          background: `linear-gradient(to left, color-mix(in srgb, var(--ad-accent) 22%, transparent) ${pct}, transparent ${pct})`
        }}
      >
        {formatNanos(node.total)}
      </span>
      <span className="num">{formatNanos(node.self)}</span>
      <span className="num">{node.soql || ''}</span>
      <span className="num">{node.dml || ''}</span>
      <span className="num">
        <Box
          component="button"
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={e => {
            e.stopPropagation()
            onJump()
          }}
          title={`Go to line ${node.line} in the log`}
          sx={{
            all: 'unset',
            cursor: 'pointer',
            color: 'primary.main',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {node.line}
        </Box>
      </span>
    </Box>
  )
}

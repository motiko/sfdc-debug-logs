// The execution tree of a log: the units that ran (execution, code units,
// methods, constructors, system methods, SOQL, SOSL, DML, callouts, flows,
// Visualforce calls, workflow) nested as they were called, with their
// duration from the entries' nanosecond timestamps, their own time (minus
// the units they called) and the SOQL and DML they ran. The app's call tree
// and timeline (pages/logs/components/execution-*.js) draw this model.
//
// Logs aren't always balanced: a truncated log (Salesforce stops writing at
// 20 MB) ends with units still open, and an end entry can be missing or have
// no begin. An end closes the nearest open unit of its kind, and the units
// opened inside it that never ended; an end with no open unit of its kind is
// ignored; units still open at the end of the log end with its last entry.
// Those units are marked `unclosed`.
//
// Everything is iterative (no recursion), so a deep or unbalanced log can't
// overflow the stack.
import type { LogLine } from './log-lines'
import { sfIdRegex } from './parsing'

export type UnitKind =
  | 'execution'
  | 'codeUnit'
  | 'method'
  | 'constructor'
  | 'systemMethod'
  | 'soql'
  | 'sosl'
  | 'dml'
  | 'callout'
  | 'flow'
  | 'flowElement'
  | 'visualforce'
  | 'workflow'

interface UnitType {
  kind: UnitKind
  end: string
}

// Begin event -> its kind and end event.
export const UNIT_EVENTS: Record<string, UnitType> = {
  EXECUTION_STARTED: { kind: 'execution', end: 'EXECUTION_FINISHED' },
  CODE_UNIT_STARTED: { kind: 'codeUnit', end: 'CODE_UNIT_FINISHED' },
  METHOD_ENTRY: { kind: 'method', end: 'METHOD_EXIT' },
  CONSTRUCTOR_ENTRY: { kind: 'constructor', end: 'CONSTRUCTOR_EXIT' },
  SYSTEM_METHOD_ENTRY: { kind: 'systemMethod', end: 'SYSTEM_METHOD_EXIT' },
  SYSTEM_CONSTRUCTOR_ENTRY: {
    kind: 'systemMethod',
    end: 'SYSTEM_CONSTRUCTOR_EXIT'
  },
  SOQL_EXECUTE_BEGIN: { kind: 'soql', end: 'SOQL_EXECUTE_END' },
  SOSL_EXECUTE_BEGIN: { kind: 'sosl', end: 'SOSL_EXECUTE_END' },
  DML_BEGIN: { kind: 'dml', end: 'DML_END' },
  CALLOUT_REQUEST: { kind: 'callout', end: 'CALLOUT_RESPONSE' },
  FLOW_START_INTERVIEW_BEGIN: {
    kind: 'flow',
    end: 'FLOW_START_INTERVIEW_END'
  },
  FLOW_ELEMENT_BEGIN: { kind: 'flowElement', end: 'FLOW_ELEMENT_END' },
  VF_APEX_CALL_START: { kind: 'visualforce', end: 'VF_APEX_CALL_END' },
  WF_RULE_EVAL_BEGIN: { kind: 'workflow', end: 'WF_RULE_EVAL_END' }
}

const END_EVENTS = new Set(Object.values(UNIT_EVENTS).map(u => u.end))
// End events that name the unit they end.
const NAMED_ENDS = new Set([
  'CODE_UNIT_FINISHED',
  'METHOD_EXIT',
  'CONSTRUCTOR_EXIT',
  'SYSTEM_METHOD_EXIT',
  'SYSTEM_CONSTRUCTOR_EXIT'
])

export const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  execution: 'Execution',
  codeUnit: 'Code unit',
  method: 'Method',
  constructor: 'Constructor',
  systemMethod: 'System method',
  soql: 'SOQL',
  sosl: 'SOSL',
  dml: 'DML',
  callout: 'Callout',
  flow: 'Flow',
  flowElement: 'Flow element',
  visualforce: 'Visualforce',
  workflow: 'Workflow'
}

export interface ExecNode {
  // Position in tree.nodes (pre-order: a unit comes before what it called).
  id: number
  kind: UnitKind
  // The begin entry's event type (METHOD_ENTRY, SOQL_EXECUTE_BEGIN, …).
  event: string
  name: string
  // LogLine.number of the begin entry, and of the end entry (-1 if none).
  line: number
  endLine: number
  // Nanoseconds since the start of the transaction.
  start: number
  end: number
  // end - start, and that minus the children's total.
  total: number
  self: number
  depth: number
  parent: ExecNode | null
  children: ExecNode[]
  // 1-based position among its siblings (the roots, for a root).
  position: number
  // SOQL/SOSL queries and DML statements run by this unit and its children.
  soql: number
  dml: number
  // Rows returned (SOQL) or written (DML), if the log says.
  rows?: number
  // No end entry: the log was truncated, or the end is missing.
  unclosed: boolean
}

export interface ExecutionTree {
  roots: ExecNode[]
  // Every unit, pre-order (nodes[i].id === i).
  nodes: ExecNode[]
  // First and last timestamp of the log (ns).
  start: number
  end: number
  maxDepth: number
}

const timestampRegex = /^\d\d:\d\d:\d\d\.\d{0,3}\s\((\d+)\)\|/

export function nanosOf(text: string): number | null {
  const match = timestampRegex.exec(text)
  return match ? Number(match[1]) : null
}

const MAX_NAME = 300
const isId = (field: string) => {
  const match = field.match(sfIdRegex)
  return Boolean(match && match[0] === field)
}

// A readable name for a unit from its begin entry.
export function unitName(kind: UnitKind, event: string, text: string): string {
  const firstLine = text.split('\n', 1)[0]
  // [time, event, ...fields]
  const fields = firstLine.split('|').slice(2)
  const meaningful = fields.filter(
    f => f && !/^\[[^\]]*\]$/.test(f) && !isId(f)
  )
  let name = ''
  switch (kind) {
    case 'execution':
      name = 'Execution'
      break
    case 'soql': {
      // SOQL_EXECUTE_BEGIN|[1]|Aggregations:0|SELECT … (may span lines)
      const at = text.indexOf('|Aggregations:')
      const query = at >= 0 ? text.slice(text.indexOf('|', at + 1) + 1) : ''
      name = (query || meaningful.join(' ')).replace(/\s+/g, ' ').trim()
      break
    }
    case 'sosl':
      // SOSL_EXECUTE_BEGIN|[1]|FIND … (may span lines)
      name = text
        .replace(/^[^|]*\|[^|]*\|(\[[^\]]*\]\|)?/, '')
        .replace(/\s+/g, ' ')
      break
    case 'dml': {
      const op = /\|Op:([^|]*)/.exec(firstLine)
      const type = /\|Type:([^|]*)/.exec(firstLine)
      name = [op && op[1], type && type[1]].filter(Boolean).join(' ')
      break
    }
    case 'callout': {
      const endpoint = /Endpoint=([^,\]]+)/.exec(firstLine)
      const method = /Method=(\w+)/.exec(firstLine)
      name = endpoint
        ? [method && method[1], endpoint[1]].filter(Boolean).join(' ')
        : meaningful.join(' ')
      break
    }
    case 'flow':
    case 'visualforce':
      name = fields[fields.length - 1] || ''
      break
    case 'flowElement':
      name = fields.slice(-2).join(' ')
      break
    case 'workflow':
      name = 'Workflow rules'
      break
    case 'constructor': {
      // CONSTRUCTOR_ENTRY|[1]|01p…|<init>()|MyClass
      const init = meaningful.findIndex(f => f.startsWith('<init>'))
      name =
        init >= 0 && meaningful[init + 1]
          ? `new ${meaningful[init + 1]}${meaningful[init].slice(6)}`
          : meaningful.join(' ')
      break
    }
    default:
      // Code units, methods, system methods: the first field that isn't a
      // line number or an id (a trigger's "X on Account trigger event …",
      // "execute_anonymous_apex", "MyClass.run()").
      name = meaningful[0] || ''
  }
  name = name.trim() || event
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name
}

function rowsOf(text: string): number | undefined {
  const match = /\|Rows:(\d+)/.exec(text)
  return match ? Number(match[1]) : undefined
}

// Builds the tree from the log's lines (core/log/log-lines.ts buildLines).
export function buildExecutionTree(lines: readonly LogLine[]): ExecutionTree {
  const nodes: ExecNode[] = []
  const roots: ExecNode[] = []
  const stack: ExecNode[] = []
  let first: number | null = null
  let last = 0
  let maxDepth = 0

  const close = (node: ExecNode, end: number, endLine: number) => {
    node.end = Math.max(node.start, end)
    node.endLine = endLine
    node.unclosed = endLine < 0
  }

  for (const line of lines) {
    const event = line.eventType
    if (!event) continue
    const unit = UNIT_EVENTS[event]
    const isEnd = !unit && END_EVENTS.has(event)
    if (!unit && !isEnd) {
      // Only the first and last timestamps matter for other entries.
      if (first === null) {
        const t = nanosOf(line.text)
        if (t !== null) first = last = t
      }
      continue
    }
    const time = nanosOf(line.text)
    if (time === null) continue
    if (first === null) first = time
    last = Math.max(last, time)

    if (unit) {
      const parent = stack.length ? stack[stack.length - 1] : null
      const node: ExecNode = {
        id: nodes.length,
        kind: unit.kind,
        event,
        name: unitName(unit.kind, event, line.text),
        line: line.number,
        endLine: -1,
        start: time,
        end: time,
        total: 0,
        self: 0,
        depth: stack.length,
        parent,
        children: [],
        position: (parent ? parent.children : roots).length + 1,
        soql: unit.kind === 'soql' || unit.kind === 'sosl' ? 1 : 0,
        dml: unit.kind === 'dml' ? 1 : 0,
        unclosed: true
      }
      if (unit.kind === 'dml') node.rows = rowsOf(line.text)
      nodes.push(node)
      if (parent) parent.children.push(node)
      else roots.push(node)
      stack.push(node)
      maxDepth = Math.max(maxDepth, node.depth)
    } else {
      // The nearest open unit this event ends: by name first (an exit names
      // its method, so a missing exit doesn't end the wrong method), then
      // by kind alone.
      const ends = (node: ExecNode) => UNIT_EVENTS[node.event].end === event
      let at = -1
      if (NAMED_ENDS.has(event)) {
        const kind = UNIT_EVENTS[stack.find(ends)?.event ?? '']?.kind
        const name = kind ? unitName(kind, event, line.text) : ''
        at = stack.length - 1
        while (at >= 0 && !(ends(stack[at]) && stack[at].name === name)) at--
      }
      if (at < 0) {
        at = stack.length - 1
        while (at >= 0 && !ends(stack[at])) at--
      }
      if (at < 0) continue
      // Units opened inside it that never ended end here too.
      while (stack.length - 1 > at) close(stack.pop()!, time, -1)
      const node = stack.pop()!
      close(node, time, line.number)
      if (node.kind === 'soql') node.rows = rowsOf(line.text)
    }
  }
  // The last timestamp of the log, for units still open.
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = nanosOf(lines[i].text)
    if (t !== null) {
      last = Math.max(last, t)
      break
    }
  }
  while (stack.length) close(stack.pop()!, last, -1)

  // Totals, own time and counts, children before parents.
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    node.total = node.end - node.start
    let childTotal = 0
    for (const child of node.children) {
      childTotal += child.total
      node.soql += child.soql
      node.dml += child.dml
    }
    node.self = Math.max(0, node.total - childTotal)
  }
  return {
    roots,
    nodes,
    start: first ?? 0,
    end: Math.max(first ?? 0, last),
    maxDepth
  }
}

// The nodes shown in a tree with these nodes expanded: pre-order, children
// only under expanded nodes.
export function visibleNodes(
  roots: readonly ExecNode[],
  expanded: ReadonlySet<number>
): ExecNode[] {
  const result: ExecNode[] = []
  const pending: ExecNode[] = [...roots].reverse()
  while (pending.length) {
    const node = pending.pop()!
    result.push(node)
    if (node.children.length && expanded.has(node.id)) {
      for (let i = node.children.length - 1; i >= 0; i--)
        pending.push(node.children[i])
    }
  }
  return result
}

// The ids of nodes with children up to `depth` levels deep, for the tree's
// first view.
export function expandedToDepth(
  tree: ExecutionTree,
  depth: number
): Set<number> {
  const ids = new Set<number>()
  for (const node of tree.nodes)
    if (node.depth < depth && node.children.length) ids.add(node.id)
  return ids
}

// Every node with children.
export function allExpandable(tree: ExecutionTree): Set<number> {
  return expandedToDepth(tree, Infinity)
}

export interface Bar {
  node: ExecNode
  // Pixels from the left edge, and width (at least `minWidth`).
  x: number
  width: number
}

// The timeline's bars for the window [from, to] (ns) drawn `width` pixels
// wide: units that overlap the window and are at least `minWidth` pixels
// wide, so a 20 MB log draws only what can be seen. Children of a unit too
// narrow to draw are skipped too (they are narrower still).
export function timelineBars(
  roots: readonly ExecNode[],
  from: number,
  to: number,
  width: number,
  minWidth = 0.5
): Bar[] {
  const bars: Bar[] = []
  const span = to - from
  if (span <= 0 || width <= 0) return bars
  const scale = width / span
  const pending: ExecNode[] = [...roots].reverse()
  while (pending.length) {
    const node = pending.pop()!
    if (node.end < from || node.start > to) continue
    const w = (node.end - node.start) * scale
    if (w < minWidth) continue
    bars.push({ node, x: (node.start - from) * scale, width: w })
    for (let i = node.children.length - 1; i >= 0; i--)
      pending.push(node.children[i])
  }
  return bars
}

// A duration in nanoseconds, for people: "850 µs", "12.3 ms", "1.24 s".
export function formatNanos(ns: number): string {
  if (ns < 1000) return `${Math.round(ns)} ns`
  if (ns < 1_000_000) return `${round(ns / 1000)} µs`
  if (ns < 1_000_000_000) return `${round(ns / 1_000_000)} ms`
  return `${round(ns / 1_000_000_000)} s`
}

const round = (n: number) =>
  n >= 100
    ? String(Math.round(n))
    : n >= 10
      ? n.toFixed(1).replace(/\.0$/, '')
      : n.toFixed(2).replace(/\.?0+$/, '')

// The row of `lines` (the visible lines) that shows log line `number`, or
// the first one after it if that line is hidden; -1 if none.
export function rowForLine(lines: readonly LogLine[], number: number): number {
  let lo = 0
  let hi = lines.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].number < number) lo = mid + 1
    else hi = mid
  }
  return lo < lines.length ? lo : lines.length - 1
}

// A summary of an opened log: governor limit usage per namespace
// (LIMIT_USAGE_FOR_NS), exceptions and fatal errors, SOQL queries grouped by
// their text (count, rows, time, the same query run again from the same source
// line: a likely query in a loop) and DML grouped by operation and object.
// Every item keeps the line numbers (LogLine.number) it came from, so the
// viewer can jump to them.
//
// One pass over the lines; only the entries of the event types above are
// parsed, so it stays fast for 20 MB logs.
import type { LogLine } from './log-lines'

export interface LimitUsage {
  // As Salesforce writes it: "Number of SOQL queries", "Maximum CPU time", …
  name: string
  used: number
  max: number
  // The LIMIT_USAGE_FOR_NS entry the value comes from.
  line: number
}

export interface NamespaceLimits {
  // "(default)" for code outside managed packages, else the package namespace.
  namespace: string
  limits: LimitUsage[]
}

export interface LogIssue {
  eventType: 'EXCEPTION_THROWN' | 'FATAL_ERROR'
  // The first line of the message ("System.MathException: Divide by 0").
  message: string
  // Apex source line ("[12]"), when the entry has one.
  sourceLine: number | null
  line: number
}

interface Group {
  count: number
  rows: number
  // Sum of END - BEGIN, in milliseconds; null when no END was found.
  timeMs: number | null
  // The BEGIN entries, in log order.
  lines: number[]
  // Run more than once from the same Apex source line.
  possibleLoop: boolean
}

export interface SoqlGroup extends Group {
  // The query with its whitespace collapsed.
  query: string
}

export interface DmlGroup extends Group {
  // "Insert", "Update", …
  operation: string
  // "Account", …
  object: string
}

export interface LogSummary {
  limits: NamespaceLimits[]
  issues: LogIssue[]
  // More issues than MAX_ISSUES were found (only the first ones are kept).
  issuesTruncated: boolean
  soql: SoqlGroup[]
  dml: DmlGroup[]
  soqlCount: number
  dmlCount: number
}

export const MAX_ISSUES = 500

const nanosRegex = /^\d\d:\d\d:\d\d\.\d{0,3}\s\((\d+)\)\|/
const sourceLineRegex = /^\[(\d+)\]$/
const limitRegex = /^\s*([^:\n]+?):\s*(\d+)\s+out of\s+(\d+)/gm

const nanosOf = (text: string): number | null => {
  const m = nanosRegex.exec(text)
  return m ? Number(m[1]) : null
}

// The entry's fields after the time: ["SOQL_EXECUTE_BEGIN", "[2]", …]. Only
// `count` fields are split off; `rest` is everything after them, or null when
// the entry has no more fields.
function fieldsOf(text: string, count: number) {
  const prefix = nanosRegex.exec(text)
  const body = prefix ? text.slice(prefix[0].length) : text
  const parts: string[] = []
  let from = 0
  for (let i = 0; i < count; i++) {
    const bar = body.indexOf('|', from)
    if (bar < 0) {
      parts.push(body.slice(from))
      return { parts, rest: null }
    }
    parts.push(body.slice(from, bar))
    from = bar + 1
  }
  return { parts, rest: body.slice(from) as string | null }
}

const sourceLineOf = (field: string | undefined): number | null => {
  const m = field ? sourceLineRegex.exec(field) : null
  return m ? Number(m[1]) : null
}

const keyField = (text: string, key: string): string | null => {
  const m = new RegExp(`\\|${key}:([^|\\n]*)`).exec(text)
  return m ? m[1].trim() : null
}

export function summarizeLog(lines: readonly LogLine[]): LogSummary {
  const namespaces = new Map<string, Map<string, LimitUsage>>()
  const issues: LogIssue[] = []
  let issuesTruncated = false
  const soql = new Map<string, SoqlGroup & { sources: Map<string, number> }>()
  const dml = new Map<string, DmlGroup & { sources: Map<string, number> }>()
  let soqlCount = 0
  let dmlCount = 0
  type Pending = {
    group: Group & { sources: Map<string, number> }
    nanos: number | null
  }
  const openSoql: Pending[] = []
  const openDml: Pending[] = []

  const begin = (
    map: Map<string, Group & { sources: Map<string, number> }>,
    key: string,
    create: () => Group & { sources: Map<string, number> },
    line: LogLine,
    source: string,
    rows: number
  ): Pending => {
    let group = map.get(key)
    if (!group) map.set(key, (group = create()))
    group.count++
    group.rows += rows
    group.lines.push(line.number)
    const runs = (group.sources.get(source) || 0) + 1
    group.sources.set(source, runs)
    if (runs > 1 && source) group.possibleLoop = true
    return { group, nanos: nanosOf(line.text) }
  }
  const end = (pending: Pending | undefined, line: LogLine) => {
    if (!pending) return
    const nanos = nanosOf(line.text)
    if (pending.nanos === null || nanos === null) return
    const ms = Math.max(0, nanos - pending.nanos) / 1e6
    pending.group.timeMs = (pending.group.timeMs || 0) + ms
  }
  const newGroup = () => ({
    count: 0,
    rows: 0,
    timeMs: null,
    lines: [],
    possibleLoop: false,
    sources: new Map<string, number>()
  })

  for (const line of lines) {
    const type = line.eventType
    if (!type) continue
    switch (type) {
      case 'SOQL_EXECUTE_BEGIN': {
        const { parts, rest } = fieldsOf(line.text, 3)
        // "SOQL_EXECUTE_BEGIN|[2]|Aggregations:0|SELECT …"; older logs have
        // no Aggregations field.
        const query = (
          parts[2] && !parts[2].startsWith('Aggregations:')
            ? [parts[2], rest].filter(p => p !== null).join('|')
            : rest || ''
        )
          .replace(/\s+/g, ' ')
          .trim()
        soqlCount++
        openSoql.push(
          begin(
            soql,
            query,
            () => ({ ...newGroup(), query }),
            line,
            parts[1] || '',
            0
          )
        )
        break
      }
      case 'SOQL_EXECUTE_END': {
        const pending = openSoql.pop()
        const rows = Number(keyField(line.text, 'Rows'))
        if (pending && rows) pending.group.rows += rows
        end(pending, line)
        break
      }
      case 'DML_BEGIN': {
        const { parts } = fieldsOf(line.text, 2)
        const operation = keyField(line.text, 'Op') || 'Unknown'
        const object = keyField(line.text, 'Type') || 'Unknown'
        const rows = Number(keyField(line.text, 'Rows')) || 0
        dmlCount++
        openDml.push(
          begin(
            dml,
            `${operation}\n${object}`,
            () => ({ ...newGroup(), operation, object }),
            line,
            parts[1] || '',
            rows
          )
        )
        break
      }
      case 'DML_END':
        end(openDml.pop(), line)
        break
      case 'EXCEPTION_THROWN':
      case 'FATAL_ERROR': {
        if (issues.length >= MAX_ISSUES) {
          issuesTruncated = true
          break
        }
        const { parts, rest } = fieldsOf(line.text, 2)
        const sourceLine = sourceLineOf(parts[1])
        const message =
          sourceLine === null && parts.length > 1
            ? [parts[1], rest].filter(p => p !== null).join('|')
            : rest || ''
        issues.push({
          eventType: type,
          message: message.split('\n')[0].trim(),
          sourceLine,
          line: line.number
        })
        break
      }
      case 'LIMIT_USAGE_FOR_NS': {
        const { parts } = fieldsOf(line.text, 2)
        const namespace = parts[1] || '(default)'
        let limits = namespaces.get(namespace)
        if (!limits) namespaces.set(namespace, (limits = new Map()))
        for (const m of line.text.matchAll(limitRegex)) {
          const [, name, used, max] = m
          const previous = limits.get(name)
          // Usage is cumulative: keep the highest (the last) value.
          if (!previous || Number(used) >= previous.used) {
            limits.set(name, {
              name,
              used: Number(used),
              max: Number(max),
              line: line.number
            })
          }
        }
        break
      }
    }
  }

  const strip = <T extends { sources: unknown }>({
    sources: _sources,
    ...group
  }: T) => group
  return {
    limits: [...namespaces]
      .map(([namespace, limits]) => ({
        namespace,
        limits: [...limits.values()]
      }))
      .sort(
        (a, b) =>
          Number(b.namespace === '(default)') -
          Number(a.namespace === '(default)')
      ),
    issues,
    issuesTruncated,
    soql: [...soql.values()].map(strip),
    dml: [...dml.values()].map(strip),
    soqlCount,
    dmlCount
  }
}

export type LimitLevel = 'ok' | 'warning' | 'critical'

// Amber from 70 % of a limit, red from 90 %.
export function limitLevel(used: number, max: number): LimitLevel {
  if (!max) return 'ok'
  const ratio = used / max
  return ratio >= 0.9 ? 'critical' : ratio >= 0.7 ? 'warning' : 'ok'
}

export type GroupSortKey = 'count' | 'rows' | 'timeMs'

// Groups sorted by count, rows or time (descending, or ascending), ties in
// log order.
export function sortGroups<T extends Group>(
  groups: readonly T[],
  key: GroupSortKey,
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return groups
    .map((group, index) => ({ group, index }))
    .sort(
      (a, b) =>
        sign * ((a.group[key] || 0) - (b.group[key] || 0)) || a.index - b.index
    )
    .map(({ group }) => group)
}

// The first of `lineNumbers` (ascending) after `after`, wrapping around to
// the first one: clicking a group again goes to its next occurrence.
export function nextOccurrence(
  lineNumbers: readonly number[],
  after: number
): number {
  if (!lineNumbers.length) return -1
  let lo = 0
  let hi = lineNumbers.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (lineNumbers[mid] <= after) lo = mid + 1
    else hi = mid
  }
  return lo < lineNumbers.length ? lineNumbers[lo] : lineNumbers[0]
}

// The row of line `number` in the visible lines (sorted by number), or -1 if
// it is hidden.
export function rowOfLine(lines: readonly LogLine[], number: number): number {
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const at = lines[mid].number
    if (at === number) return mid
    if (at < number) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

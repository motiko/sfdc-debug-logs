// The app's model of an opened log: one line per entry (plus the header),
// with its event type and color category; counts per category for the event
// toggles; find-in-log matches; and the pieces a line is drawn from (time,
// event type, message, ids, highlighted matches). Plain functions, so the
// viewer (pages/logs/components/parsed-log.js) stays a thin renderer.
import { eventCategory, type LogCategory, LOG_CATEGORIES } from './categories'
import { eventTypeOf, sfIdRegex, splitLog } from './parsing'

export interface LogLine {
  // Position in the whole log: 0 is the header, then one per entry. Shown in
  // the gutter, and stable when categories are hidden.
  number: number
  text: string
  // null for the header.
  eventType: string | null
  category: LogCategory
}

export function buildLines(body: string): LogLine[] {
  if (!body) return []
  const { intro, entries } = splitLog(body)
  const lines: LogLine[] = [
    { number: 0, text: intro || '', eventType: null, category: 'system' }
  ]
  entries.forEach((text, i) => {
    const eventType = eventTypeOf(text)
    lines.push({
      number: i + 1,
      text,
      eventType,
      category: eventType ? eventCategory(eventType) : 'rest'
    })
  })
  return lines
}

export type CategoryCounts = Record<LogCategory, number>

// Entries per category (the header isn't counted).
export function categoryCounts(lines: LogLine[]): CategoryCounts {
  const counts = Object.fromEntries(
    LOG_CATEGORIES.map(c => [c, 0])
  ) as CategoryCounts
  for (const line of lines) if (line.number > 0) counts[line.category]++
  return counts
}

// The lines to show: the header always, entries of hidden categories not.
export function visibleLines(
  lines: LogLine[],
  hidden: readonly string[]
): LogLine[] {
  if (!hidden || hidden.length === 0) return lines
  const hide = new Set(hidden)
  return lines.filter(line => line.number === 0 || !hide.has(line.category))
}

export interface Match {
  // Index into the visible lines.
  row: number
  // Which occurrence within that line (0-based).
  nth: number
}

// Every occurrence of `term` in the lines, ignoring case, up to `limit`.
export function findMatches(
  lines: LogLine[],
  term: string,
  limit = 10000
): Match[] {
  const needle = (term || '').toLowerCase()
  if (!needle) return []
  const matches: Match[] = []
  for (let row = 0; row < lines.length && matches.length < limit; row++) {
    const text = lines[row].text.toLowerCase()
    let from = 0
    let nth = 0
    for (;;) {
      const at = text.indexOf(needle, from)
      if (at < 0 || matches.length >= limit) break
      matches.push({ row, nth: nth++ })
      from = at + needle.length
    }
  }
  return matches
}

// The next (dir 1) or previous (dir -1) row after `from` whose line passes
// `test`, wrapping around; -1 if none does.
export function nextRow(
  lines: LogLine[],
  from: number,
  dir: 1 | -1,
  test: (line: LogLine) => boolean
): number {
  const n = lines.length
  for (let step = 1; step <= n; step++) {
    const row = (((from + dir * step) % n) + n) % n
    if (test(lines[row])) return row
  }
  return -1
}

export const isErrorLine = (line: LogLine) => line.category === 'error'
export const isDebugLine = (line: LogLine) => line.eventType === 'USER_DEBUG'

export interface Segment {
  text: string
  // The entry's "12:01:02.123 (1234567)|" prefix, its event type, or the
  // rest of the entry.
  part: 'time' | 'event' | 'message'
  // Part of a Salesforce id (linked).
  id?: string
  // Part of the nth find match in the line.
  match?: number
}

const entryPrefix = /^(\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|)([A-Z_]*)/

// Splits a line's text into the pieces it is drawn from: the time prefix and
// event type (styled apart from the message), Salesforce ids (links) and
// find matches (highlighted). All text is kept, in order.
export function segments(text: string, term = ''): Segment[] {
  type Range = [number, number]
  const cuts = new Set<number>([0, text.length])
  const prefix = entryPrefix.exec(text)
  const timeEnd = prefix ? prefix[1].length : 0
  const eventEnd = prefix ? timeEnd + prefix[2].length : 0
  cuts.add(timeEnd).add(eventEnd)

  const ids: [number, number, string][] = []
  for (const m of text.matchAll(sfIdRegex)) {
    ids.push([m.index, m.index + m[0].length, m[0]])
    cuts.add(m.index).add(m.index + m[0].length)
  }
  const matches: Range[] = []
  const needle = term.toLowerCase()
  if (needle) {
    const lower = text.toLowerCase()
    for (
      let at = lower.indexOf(needle);
      at >= 0;
      at = lower.indexOf(needle, at + needle.length)
    ) {
      matches.push([at, at + needle.length])
      cuts.add(at).add(at + needle.length)
    }
  }
  const points = [...cuts].sort((a, b) => a - b)
  const result: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]]
    if (start === end) continue
    const segment: Segment = {
      text: text.slice(start, end),
      part: start < timeEnd ? 'time' : start < eventEnd ? 'event' : 'message'
    }
    const id = ids.find(([s, e]) => start >= s && end <= e)
    if (id) segment.id = id[2]
    const match = matches.findIndex(([s, e]) => start >= s && end <= e)
    if (match >= 0) segment.match = match
    const previous = result[result.length - 1]
    if (
      previous &&
      previous.part === segment.part &&
      previous.id === segment.id &&
      previous.match === segment.match
    ) {
      previous.text += segment.text
    } else result.push(segment)
  }
  return result
}

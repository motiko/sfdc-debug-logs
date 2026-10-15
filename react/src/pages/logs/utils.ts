// The log list's filters, sorting and display formats. Filters are shown as
// chips and are only active when the user sets them (no hidden defaults:
// docs/ux/baseline-review.md B1). They are sent to Salesforce as a SOQL WHERE
// clause (filtersToWhereClause) and applied to the loaded logs (filterLogs).

// The ApexLog fields the list reads (Tooling API record).
export interface ApexLog {
  Id: string
  LogUser: { Name: string }
  LogUserId?: string
  Operation?: string
  Status?: string
  LogLength?: number
  DurationMilliseconds?: number
  StartTime?: string
  [field: string]: unknown
}

// Status filter value that keeps every log whose status isn't Success.
export const FAILED = '__failed__'

export interface ListFilters {
  // Exact values ('' = any).
  user: string
  operation: string
  // '' = any, FAILED = not Success, or an exact status.
  status: string
  // Lower bounds; 0 = off.
  minLength: number
  minDuration: number
}

export const NO_FILTERS: ListFilters = {
  user: '',
  operation: '',
  status: '',
  minLength: 0,
  minDuration: 0
}

export const SIZE_STEPS = [100_000, 1_000_000, 5_000_000]
export const DURATION_STEPS = [1_000, 5_000, 30_000]

export interface FilterChip {
  key: keyof ListFilters
  // "Operation: executeAnonymous"
  label: string
}

// The active filters as chips, in a fixed order.
export function activeFilterChips(filters: ListFilters): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.user) chips.push({ key: 'user', label: `User: ${filters.user}` })
  if (filters.operation) {
    chips.push({
      key: 'operation',
      label: `Operation: ${shortOperation(filters.operation)}`
    })
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label:
        filters.status === FAILED ? 'Failed only' : `Status: ${filters.status}`
    })
  }
  if (filters.minLength > 0) {
    chips.push({
      key: 'minLength',
      label: `Larger than ${formatBytes(filters.minLength)}`
    })
  }
  if (filters.minDuration > 0) {
    chips.push({
      key: 'minDuration',
      label: `Longer than ${formatDuration(filters.minDuration)}`
    })
  }
  return chips
}

export const isFailed = (log: ApexLog) =>
  Boolean(log.Status) && log.Status !== 'Success'

export function matchesFilters(log: ApexLog, filters: ListFilters): boolean {
  if (filters.user && log.LogUser?.Name !== filters.user) return false
  if (filters.operation && log.Operation !== filters.operation) return false
  if (
    filters.status === FAILED
      ? !isFailed(log)
      : filters.status && log.Status !== filters.status
  ) {
    return false
  }
  if (filters.minLength > 0 && !((log.LogLength || 0) >= filters.minLength))
    return false
  if (
    filters.minDuration > 0 &&
    !((log.DurationMilliseconds || 0) >= filters.minDuration)
  )
    return false
  return true
}

// The logs that pass the filters and, while a search is active, contain the
// search term (matches: log id -> number of occurrences; null = no search).
export function filterLogs(
  logs: ApexLog[],
  filters: ListFilters,
  matches: Record<string, number> | null = null
): ApexLog[] {
  return logs.filter(
    log =>
      matchesFilters(log, filters) && (!matches || (matches[log.Id] || 0) > 0)
  )
}

const soqlText = (value: string) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function filtersToWhereClause(filters: ListFilters): string {
  const conditions: string[] = []
  if (filters.user) conditions.push(`LogUser.Name = ${soqlText(filters.user)}`)
  if (filters.operation)
    conditions.push(`Operation = ${soqlText(filters.operation)}`)
  if (filters.status === FAILED) conditions.push("Status != 'Success'")
  else if (filters.status)
    conditions.push(`Status = ${soqlText(filters.status)}`)
  // Whole numbers only: the values go into the query as they are.
  const whole = (n: number) => Math.max(0, Math.floor(Number(n) || 0))
  if (whole(filters.minLength) > 0)
    conditions.push(`LogLength >= ${whole(filters.minLength)}`)
  if (whole(filters.minDuration) > 0) {
    conditions.push(`DurationMilliseconds >= ${whole(filters.minDuration)}`)
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
}

// The checked logs among those shown, in list order, and the state of the
// "select all shown logs" box. Checked logs hidden by the search or a filter
// are left out: only what the list shows is ever deleted.
export function shownSelection(
  shown: ApexLog[],
  selectedIds: Record<string, true>
): { ids: string[]; all: boolean; some: boolean } {
  const ids = shown.filter(log => selectedIds[log.Id]).map(log => log.Id)
  return {
    ids,
    all: shown.length > 0 && ids.length === shown.length,
    some: ids.length > 0 && ids.length < shown.length
  }
}

export type SortKey = 'time' | 'duration' | 'size'
export interface Sort {
  key: SortKey
  direction: 'asc' | 'desc'
}

const sortValue: Record<SortKey, (log: ApexLog) => number> = {
  time: log => Date.parse(log.StartTime || '') || 0,
  duration: log => log.DurationMilliseconds || 0,
  size: log => log.LogLength || 0
}

// A sorted copy; ties keep the list's order (newest first).
export function sortLogs(logs: ApexLog[], { key, direction }: Sort): ApexLog[] {
  const sign = direction === 'asc' ? 1 : -1
  return logs
    .map((log, i) => [log, i] as const)
    .sort(
      ([a, i], [b, j]) =>
        sign * (sortValue[key](a) - sortValue[key](b)) || i - j
    )
    .map(([log]) => log)
}

// "/services/data/v62.0/tooling/executeAnonymous/" -> "executeAnonymous";
// "Batch Apex" stays as it is.
export function shortOperation(operation = ''): string {
  if (!operation.startsWith('/')) return operation
  const parts = operation.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : operation
}

// 512 -> "512 B", 16918 -> "16.9 KB", 2500000 -> "2.5 MB" (1 KB = 1000 B,
// as Salesforce counts the 20 MB log limit).
export function formatBytes(bytes = 0): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${trim(bytes / 1000)} KB`
  return `${trim(bytes / 1_000_000)} MB`
}

// 86 -> "86 ms", 1234 -> "1.2 s", 125000 -> "2 min 5 s".
export function formatDuration(ms = 0): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${trim(ms / 1000)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
}

const trim = (n: number) =>
  n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short'
})

// The time a log started, for the list: "14:47:15", with the date when it
// isn't today ("Oct 10, 14:47:15").
export function formatStartTime(
  iso: string | undefined,
  now = new Date()
): string {
  const date = new Date(iso || '')
  if (isNaN(date.getTime())) return ''
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return timeFormat.format(date)
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${timeFormat.format(date)}`
}

// Full date, time and time zone, for tooltips and the log header.
export function formatFullTime(iso: string | undefined): string {
  const date = new Date(iso || '')
  return isNaN(date.getTime()) ? '' : dateTimeFormat.format(date)
}

// A time of day, with the day when it isn't today: "13:44",
// "tomorrow 13:44", "Oct 14, 13:44" (logging's end time).
export function formatClock(
  iso: string | undefined | null,
  now = new Date()
): string {
  const date = new Date(iso || '')
  if (isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return time
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

// "3 min ago", "just now", for the list's "updated" note.
export function formatRelative(then: number, now = Date.now()): string {
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

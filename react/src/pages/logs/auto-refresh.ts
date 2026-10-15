// Auto-refresh of the log list (issue #76): while the user chose an interval,
// their logging is on (an active USER_DEBUG trace flag) and the app's tab is
// visible, the list asks Salesforce for logs newer than the newest one it
// has, one small query per poll, and adds them at the top. Polls space out
// when nothing new arrives for a while and after failures, to spare the
// org's daily API limit. No imports from React: the page drives it through
// createPoller and the pure helpers below.
import { filtersToWhereClause, type ApexLog, type ListFilters } from './utils'

// Seconds between polls the user can choose; 0 is off (the default).
export const AUTO_REFRESH_INTERVALS = [0, 10, 30, 60] as const
export type AutoRefreshInterval = (typeof AUTO_REFRESH_INTERVALS)[number]

export const isAutoRefreshInterval = (
  value: unknown
): value is AutoRefreshInterval =>
  (AUTO_REFRESH_INTERVALS as readonly unknown[]).includes(value)

export const intervalLabel = (seconds: number) =>
  seconds ? `Every ${seconds} s` : 'Off'

// The longest wait between two polls, whatever the backoff.
export const MAX_DELAY_MS = 5 * 60_000
// Nothing new for this long: poll half as often; twice as long: a quarter.
export const IDLE_SLOWDOWN_MS = 5 * 60_000

export type AutoRefreshState =
  | 'off'
  | 'running'
  // Logging is off (or its trace flag expired): no new logs of the user.
  | 'paused-logging'
  // The tab is in the background.
  | 'paused-hidden'

export function autoRefreshState({
  interval,
  logging,
  visible,
  now = Date.now()
}: {
  interval: number
  logging: { status: string; expiresAt: string | null }
  visible: boolean
  now?: number
}): AutoRefreshState {
  if (!interval) return 'off'
  const expires = Date.parse(logging.expiresAt || '')
  const loggingOn = logging.status === 'on' && (isNaN(expires) || expires > now)
  if (!loggingOn) return 'paused-logging'
  if (!visible) return 'paused-hidden'
  return 'running'
}

// What the control says about the state, for its label and tooltip.
export function describeAutoRefresh(
  state: AutoRefreshState,
  interval: number,
  failing = false
): string {
  switch (state) {
    case 'off':
      return 'Auto-refresh is off'
    case 'paused-logging':
      return 'Auto-refresh paused: logging is off'
    case 'paused-hidden':
      return 'Auto-refresh paused while the tab is in the background'
    default:
      return failing
        ? 'Auto-refresh could not reach Salesforce, trying again later'
        : `Checking for new logs every ${interval} s`
  }
}

// Milliseconds until the next poll: the interval, longer after a while with
// no new logs, and doubled for each failure in a row; at most MAX_DELAY_MS.
export function nextDelay(
  intervalMs: number,
  { idleMs = 0, failures = 0 }: { idleMs?: number; failures?: number } = {}
): number {
  let delay = intervalMs
  if (idleMs >= 2 * IDLE_SLOWDOWN_MS) delay *= 4
  else if (idleMs >= IDLE_SLOWDOWN_MS) delay *= 2
  delay *= 2 ** Math.min(failures, 10)
  return Math.min(Math.max(delay, intervalMs), MAX_DELAY_MS)
}

// The newest LastModifiedDate of the loaded logs, as a SOQL dateTime
// literal (UTC), or null when there are none.
export function newestModified(logs: ApexLog[]): string | null {
  let newest = NaN
  for (const log of logs) {
    const time = Date.parse(String(log.LastModifiedDate || ''))
    if (!isNaN(time) && !(time <= newest)) newest = time
  }
  return isNaN(newest) ? null : new Date(newest).toISOString()
}

// The poll's WHERE clause: the list filters plus "not older than the newest
// known log". >= rather than >: Salesforce keeps whole seconds, so another
// log of that same second must not be missed (known ids are skipped).
export function newLogsWhereClause(
  filters: ListFilters,
  since: string | null
): string {
  const where = filtersToWhereClause(filters)
  if (!since) return where
  const time = Date.parse(since)
  if (isNaN(time)) return where
  const condition = `LastModifiedDate >= ${new Date(time).toISOString()}`
  return where ? `${where} AND ${condition}` : `WHERE ${condition}`
}

// The list with the polled logs it didn't have yet added at the top (newest
// first), trimmed to `max` logs; the open log (keepId) is never trimmed.
export function mergeNewLogs(
  logs: ApexLog[],
  polled: ApexLog[],
  max: number,
  keepId: string | null = null
): { logs: ApexLog[]; added: string[] } {
  const known = new Set(logs.map(log => log.Id))
  const fresh: ApexLog[] = []
  for (const log of polled) {
    if (!known.has(log.Id)) {
      known.add(log.Id)
      fresh.push(log)
    }
  }
  if (!fresh.length) return { logs, added: [] }
  const merged = [...fresh, ...logs]
  const limit = Math.max(max, fresh.length)
  const trimmed = merged.filter(
    (log, index) => index < limit || log.Id === keepId
  )
  return { logs: trimmed, added: fresh.map(log => log.Id) }
}

export interface Poller {
  // Runs (or stops) polling; called whenever the page's state changes.
  // lastLoadedAt: when the list was last loaded, so the first poll comes one
  // interval after it, not right away.
  update(options: {
    run: boolean
    intervalMs: number
    lastLoadedAt?: number | null
  }): void
  stop(): void
  readonly failures: number
}

// A timer loop around `poll`, which resolves with how many new logs it
// found and rejects when it fails. One poll at a time; nothing runs while
// `run` is false.
export function createPoller({
  poll,
  onFailuresChange = () => {},
  now = () => Date.now(),
  setTimer = (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimer = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
}: {
  poll: () => Promise<number>
  onFailuresChange?: (failures: number) => void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void
}): Poller {
  let run = false
  let intervalMs = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let polling = false
  let failures = 0
  // Last time the list changed (or polling started): the idle backoff.
  let lastNewAt = now()
  // Last poll or list load: when the next poll is due.
  let lastPollAt = 0

  const setFailures = (n: number) => {
    if (n !== failures) {
      failures = n
      onFailuresChange(n)
    }
  }
  const clear = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  const schedule = () => {
    clear()
    if (!run || polling) return
    const delay = nextDelay(intervalMs, {
      idleMs: now() - lastNewAt,
      failures
    })
    const wait = Math.max(0, lastPollAt + delay - now())
    timer = setTimer(tick, wait)
  }
  const tick = async () => {
    timer = null
    if (!run) return
    polling = true
    try {
      const added = await poll()
      setFailures(0)
      if (added > 0) lastNewAt = now()
    } catch {
      setFailures(failures + 1)
    } finally {
      polling = false
      lastPollAt = now()
    }
    schedule()
  }

  return {
    update(options) {
      const wasRunning = run
      const intervalChanged = options.intervalMs !== intervalMs
      run = options.run && options.intervalMs > 0
      intervalMs = options.intervalMs
      if (options.lastLoadedAt && options.lastLoadedAt > lastPollAt) {
        lastPollAt = options.lastLoadedAt
      }
      // Starting again (the tab came back, logging restarted, another
      // interval): the user is back, so poll at the chosen pace.
      if (run && (!wasRunning || intervalChanged)) {
        lastNewAt = now()
        setFailures(0)
      }
      schedule()
    },
    stop() {
      run = false
      clear()
    },
    get failures() {
      return failures
    }
  }
}

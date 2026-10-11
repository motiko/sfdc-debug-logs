import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import {
  autoRefreshState,
  createPoller,
  describeAutoRefresh,
  IDLE_SLOWDOWN_MS,
  isAutoRefreshInterval,
  MAX_DELAY_MS,
  mergeNewLogs,
  newestModified,
  newLogsWhereClause,
  nextDelay
} from './auto-refresh'
import { pollNewLogs, searchLogs } from './actions'
import logsPage, {
  initialLogsPageState,
  logsPolled,
  setFilter
} from './logs-slice'
import { NO_FILTERS, type ApexLog } from './utils'

const log = (Id: string, LastModifiedDate = '2026-10-12T10:00:00.000+0000') =>
  ({ Id, LogUser: { Name: 'Ada' }, LastModifiedDate }) as ApexLog

const ON = { status: 'on', expiresAt: '2026-10-12T12:00:00.000+0000' }
const NOW = Date.parse('2026-10-12T11:00:00Z')

describe('autoRefreshState', () => {
  it('runs only with an interval, active logging and a visible tab', () => {
    const at = (over = {}) =>
      autoRefreshState({
        interval: 10,
        logging: ON,
        visible: true,
        now: NOW,
        ...over
      })
    expect(at()).toBe('running')
    expect(at({ interval: 0 })).toBe('off')
    expect(at({ logging: { status: 'off', expiresAt: null } })).toBe(
      'paused-logging'
    )
    expect(at({ logging: { status: 'unknown', expiresAt: null } })).toBe(
      'paused-logging'
    )
    expect(at({ visible: false })).toBe('paused-hidden')
    // The trace flag ran out while the page was open.
    expect(at({ now: Date.parse('2026-10-12T12:00:01Z') })).toBe(
      'paused-logging'
    )
  })

  it('describes each state', () => {
    expect(describeAutoRefresh('running', 30)).toBe(
      'Checking for new logs every 30 s'
    )
    expect(describeAutoRefresh('paused-logging', 30)).toMatch(/logging is off/)
    expect(describeAutoRefresh('running', 30, true)).toMatch(/trying again/)
  })

  it('accepts only the offered intervals', () => {
    expect([0, 10, 30, 60].every(isAutoRefreshInterval)).toBe(true)
    expect([5, '10', null].some(isAutoRefreshInterval)).toBe(false)
  })
})

describe('nextDelay', () => {
  it('waits the interval, longer when idle, doubled per failure, capped', () => {
    expect(nextDelay(10_000)).toBe(10_000)
    expect(nextDelay(10_000, { idleMs: IDLE_SLOWDOWN_MS })).toBe(20_000)
    expect(nextDelay(10_000, { idleMs: 2 * IDLE_SLOWDOWN_MS })).toBe(40_000)
    expect(nextDelay(10_000, { failures: 1 })).toBe(20_000)
    expect(nextDelay(10_000, { failures: 3 })).toBe(80_000)
    expect(nextDelay(60_000, { failures: 20 })).toBe(MAX_DELAY_MS)
  })
})

describe('the poll query', () => {
  it('asks only for logs not older than the newest known one', () => {
    const since = newestModified([
      log('a', '2026-10-12T10:00:00.000+0000'),
      log('b', '2026-10-12T10:05:07.000+0000'),
      log('c', 'not a date')
    ])
    expect(since).toBe('2026-10-12T10:05:07.000Z')
    expect(newLogsWhereClause(NO_FILTERS, since)).toBe(
      'WHERE LastModifiedDate >= 2026-10-12T10:05:07.000Z'
    )
    expect(
      newLogsWhereClause({ ...NO_FILTERS, status: 'Success' }, since)
    ).toBe(
      "WHERE Status = 'Success' AND LastModifiedDate >= 2026-10-12T10:05:07.000Z"
    )
  })

  it('falls back to the filters alone without a known log', () => {
    expect(newestModified([])).toBeNull()
    expect(newLogsWhereClause(NO_FILTERS, null)).toBe('')
    // Never passes text it didn't make into the query.
    expect(newLogsWhereClause(NO_FILTERS, "x' OR Id != '")).toBe('')
  })
})

describe('mergeNewLogs', () => {
  it('adds unknown logs on top, newest first', () => {
    const { logs, added } = mergeNewLogs(
      [log('b'), log('a')],
      [log('d'), log('c'), log('b')],
      50
    )
    expect(logs.map(l => l.Id)).toEqual(['d', 'c', 'b', 'a'])
    expect(added).toEqual(['d', 'c'])
  })

  it('keeps the same list when nothing is new', () => {
    const old = [log('b'), log('a')]
    expect(mergeNewLogs(old, [log('b')], 50)).toEqual({ logs: old, added: [] })
  })

  it('trims the oldest beyond the list size, but never the open log', () => {
    const old = [log('c'), log('b'), log('a')]
    expect(mergeNewLogs(old, [log('d')], 3).logs.map(l => l.Id)).toEqual([
      'd',
      'c',
      'b'
    ])
    expect(mergeNewLogs(old, [log('d')], 3, 'a').logs.map(l => l.Id)).toEqual([
      'd',
      'c',
      'b',
      'a'
    ])
  })
})

describe('logsPolled', () => {
  it('marks only the new logs as new and keeps earlier marks on an empty poll', () => {
    let state = { ...initialLogsPageState, logs: [log('a')], loadedAt: 1 }
    state = logsPage(state, logsPolled({ logs: [log('b'), log('a')], at: 2 }))
    expect(state.logs.map(l => l.Id)).toEqual(['b', 'a'])
    expect(state.newIds).toEqual({ b: true })
    const same = logsPage(state, logsPolled({ logs: [log('b')], at: 3 }))
    expect(same.logs).toBe(state.logs)
    expect(same.newIds).toEqual({ b: true })
    expect(same.loadedAt).toBe(3)
  })
})

describe('pollNewLogs', () => {
  function setup(polled: ApexLog[], loaded = [log('a')]) {
    const sf = {
      hostname: 'acme.my.salesforce.com',
      recentLogs: vi.fn(async () => polled),
      logBody: vi.fn(async (_id: string) => 'body with needle')
    }
    const store = configureStore({
      reducer: { logsPage },
      preloadedState: {
        logsPage: {
          ...initialLogsPageState,
          logs: loaded,
          listStatus: 'ready' as const,
          loadedAt: 1
        }
      },
      middleware: m =>
        m({
          thunk: { extraArgument: sf },
          serializableCheck: false,
          immutableCheck: false
        })
    })
    return { store, sf, state: () => store.getState().logsPage }
  }

  it('sends one query for logs newer than the newest known, with the filters', async () => {
    const { store, sf, state } = setup([log('b'), log('a')])
    store.dispatch(setFilter({ key: 'operation', value: 'Api' }))
    const added = await store.dispatch(pollNewLogs({ keepId: 'a' }) as never)
    expect(added).toBe(1)
    expect(sf.recentLogs).toHaveBeenCalledTimes(1)
    expect(sf.recentLogs).toHaveBeenCalledWith(
      50,
      "WHERE Operation = 'Api' AND LastModifiedDate >= 2026-10-12T10:00:00.000Z"
    )
    expect(state().logs.map(l => l.Id)).toEqual(['b', 'a'])
    expect(sf.logBody).not.toHaveBeenCalled()
  })

  it('searches the new logs while a search is active', async () => {
    const { store, sf, state } = setup([log('b')])
    await store.dispatch(searchLogs('needle') as never)
    sf.logBody.mockClear()
    await store.dispatch(pollNewLogs() as never)
    expect(sf.logBody.mock.calls.map(([id]) => id)).toEqual(['b'])
    expect(state().search.matches).toEqual({ b: 1, a: 1 })
  })

  it('skips while the list is loading, and drops a result a load overtook', async () => {
    const loading = setup([log('b')])
    loading.store.dispatch({ type: 'logsPage/logsRequested' })
    expect(await loading.store.dispatch(pollNewLogs() as never)).toBe(0)
    expect(loading.sf.recentLogs).not.toHaveBeenCalled()

    const overtaken = setup([log('b')])
    overtaken.sf.recentLogs.mockImplementation(async () => {
      overtaken.store.dispatch({
        type: 'logsPage/logsLoaded',
        payload: { logs: [log('z')], at: 5 }
      })
      return [log('b')]
    })
    expect(await overtaken.store.dispatch(pollNewLogs() as never)).toBe(0)
    expect(overtaken.state().logs.map(l => l.Id)).toEqual(['z'])
  })

  it('rejects when Salesforce fails, leaving the list as it was', async () => {
    const { store, sf, state } = setup([])
    sf.recentLogs.mockRejectedValue(new Error('Failed to fetch'))
    await expect(store.dispatch(pollNewLogs() as never)).rejects.toThrow()
    expect(state().logs.map(l => l.Id)).toEqual(['a'])
  })
})

describe('createPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('polls once per interval while running, and not at all otherwise', async () => {
    const poll = vi.fn(async () => 0)
    const poller = createPoller({ poll })
    poller.update({ run: false, intervalMs: 10_000, lastLoadedAt: NOW })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(poll).not.toHaveBeenCalled()

    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(poll).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(poll).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(poll).toHaveBeenCalledTimes(3)

    // Hidden tab / logging off.
    poller.update({ run: false, intervalMs: 10_000 })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(poll).toHaveBeenCalledTimes(3)
    poller.stop()
  })

  it('polls right away when it resumes after more than an interval', async () => {
    const poll = vi.fn(async () => 0)
    const poller = createPoller({ poll })
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(10_000)
    poller.update({ run: false, intervalMs: 10_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    poller.update({ run: true, intervalMs: 10_000 })
    await vi.advanceTimersByTimeAsync(0)
    expect(poll).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('a manual refresh postpones the next poll', async () => {
    const poll = vi.fn(async () => 0)
    const poller = createPoller({ poll })
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(8_000)
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(8_000)
    expect(poll).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(poll).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('backs off after failures and recovers', async () => {
    let fail = true
    const poll = vi.fn(async () => {
      if (fail) throw new Error('offline')
      return 0
    })
    const onFailuresChange = vi.fn()
    const poller = createPoller({ poll, onFailuresChange })
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(10_000) // fails: next in 20 s
    await vi.advanceTimersByTimeAsync(20_000) // fails: next in 40 s
    expect(poll).toHaveBeenCalledTimes(2)
    expect(poller.failures).toBe(2)
    await vi.advanceTimersByTimeAsync(39_000)
    expect(poll).toHaveBeenCalledTimes(2)
    fail = false
    await vi.advanceTimersByTimeAsync(1_000)
    expect(poll).toHaveBeenCalledTimes(3)
    expect(poller.failures).toBe(0)
    expect(onFailuresChange.mock.calls.map(([n]) => n)).toEqual([1, 2, 0])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(poll).toHaveBeenCalledTimes(4)
    poller.stop()
  })

  it('slows down when nothing new arrives, and speeds up again on new logs', async () => {
    let next = 0
    const poll = vi.fn(async () => next)
    const poller = createPoller({ poll })
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(IDLE_SLOWDOWN_MS)
    const atSlowdown = poll.mock.calls.length
    expect(atSlowdown).toBe(30)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(poll.mock.calls.length - atSlowdown).toBe(3) // every 20 s
    next = 1
    await vi.advanceTimersByTimeAsync(20_000)
    next = 0
    const fast = poll.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(poll.mock.calls.length - fast).toBe(3)
    poller.stop()
  })

  it('runs one poll at a time', async () => {
    let finish: (n: number) => void = () => {}
    const poll = vi.fn(() => new Promise<number>(r => (finish = r)))
    const poller = createPoller({ poll })
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(10_000)
    poller.update({ run: true, intervalMs: 10_000, lastLoadedAt: Date.now() })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(poll).toHaveBeenCalledTimes(1)
    finish(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(poll).toHaveBeenCalledTimes(2)
    poller.stop()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import {
  countOccurrences,
  deleteLogs,
  loadLogs,
  searchLogs,
  startLogging,
  checkLogging
} from './actions'
import logsPage, { initialLogsPageState } from './logs-slice'
import { NO_FILTERS } from './utils'

const bodies = {
  '07L000000000001AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.131 (9345678)|USER_DEBUG|[2]|DEBUG|E2E_MARKER_1700000000000 e2e_marker\n',
  '07L000000000002AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.124 (2345678)|SOQL_EXECUTE_BEGIN|[1]|Aggregations:0|SELECT Id FROM Account\n',
  '07L000000000003AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.140 (16000000)|FATAL_ERROR|System.NullPointerException: Attempt to de-reference a null object\n'
}
const USER = '005000000000001AAA'
const logs = Object.keys(bodies).map(Id => ({
  Id,
  LogUser: { Name: 'Ada Admin' }
}))

// A real store with the app's reducer and a fake Salesforce client.
function setup({ cached = {}, failing = [], sf: overrides = {} } = {}) {
  const sf = {
    hostname: 'acme.my.salesforce.com',
    getUserId: vi.fn(async () => USER),
    recentLogs: vi.fn(async () => logs),
    logBody: vi.fn((id: string) =>
      failing.includes(id)
        ? Promise.reject(new Error('404: Not Found'))
        : Promise.resolve(bodies[id])
    ),
    ...overrides
  }
  const store = configureStore({
    reducer: { logsPage },
    preloadedState: {
      logsPage: { ...initialLogsPageState, logs, logBodies: cached }
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

describe('searchLogs', () => {
  it('counts matches per log, ignoring case', async () => {
    const { store, state } = setup()
    await store.dispatch(searchLogs('E2E_marker') as never)
    expect(state().search).toMatchObject({
      term: 'E2E_marker',
      status: 'done',
      done: 3,
      total: 3,
      failed: 0,
      matches: {
        '07L000000000001AAA': 2,
        '07L000000000002AAA': 0,
        '07L000000000003AAA': 0
      }
    })
  })

  it('downloads only the bodies that are not cached and keeps them', async () => {
    const cached = { '07L000000000003AAA': bodies['07L000000000003AAA'] }
    const { store, sf, state } = setup({ cached })
    await store.dispatch(searchLogs('nullpointerexception') as never)
    expect(sf.logBody.mock.calls.map(([id]) => id).sort()).toEqual([
      '07L000000000001AAA',
      '07L000000000002AAA'
    ])
    expect(state().logBodies).toEqual(bodies)
    expect(state().search.matches['07L000000000003AAA']).toBe(1)
  })

  it('counts logs whose body fails to download as failed, not matched', async () => {
    const { store, state } = setup({ failing: ['07L000000000002AAA'] })
    await store.dispatch(searchLogs('select id') as never)
    expect(state().search).toMatchObject({
      failed: 1,
      matches: { '07L000000000002AAA': 0 }
    })
  })

  it('clears the search for an empty term', async () => {
    const { store, state } = setup()
    await store.dispatch(searchLogs('marker') as never)
    await store.dispatch(searchLogs('  ') as never)
    expect(state().search.matches).toBe(null)
    expect(state().search.status).toBe('idle')
  })

  it('counts occurrences', () => {
    expect(countOccurrences('aAa', 'a')).toBe(3)
    expect(countOccurrences('abc', '')).toBe(0)
  })
})

describe('loadLogs', () => {
  it('sends only the filters the user set (none by default)', async () => {
    const { store, sf, state } = setup()
    await store.dispatch(loadLogs() as never)
    expect(sf.recentLogs).toHaveBeenCalledWith(50, '')
    expect(state().filters).toEqual(NO_FILTERS)
    expect(state().listStatus).toBe('ready')
  })

  it('loads another page for "Load more"', async () => {
    const { store, sf } = setup()
    await store.dispatch(loadLogs({ more: true }) as never)
    expect(sf.recentLogs).toHaveBeenCalledWith(100, '')
  })

  it('explains a failure instead of showing a raw message', async () => {
    const { store, state } = setup({
      sf: {
        recentLogs: vi.fn(async () =>
          Promise.reject(new TypeError('Failed to fetch'))
        )
      }
    })
    await store.dispatch(loadLogs() as never)
    expect(state().listStatus).toBe('error')
    expect(state().listError).toMatchObject({
      kind: 'network',
      title: "Can't reach acme.my.salesforce.com."
    })
  })
})

describe('logging', () => {
  it('only reads the status when checking (never starts logging)', async () => {
    const traceUser = vi.fn()
    const { store, state } = setup({
      sf: { traceStatus: vi.fn(async () => ({ active: false })), traceUser }
    })
    await store.dispatch(checkLogging() as never)
    expect(state().logging.status).toBe('off')
    expect(traceUser).not.toHaveBeenCalled()
  })

  it('starts logging when asked and confirms it', async () => {
    let active = false
    const { store, state } = setup({
      sf: {
        traceUser: vi.fn(async () => (active = true)),
        traceStatus: vi.fn(async () =>
          active
            ? {
                active: true,
                expiresAt: '2026-01-02T05:00:00.000Z',
                debugLevel: 'ApexDbgrExtension'
              }
            : { active: false }
        )
      }
    })
    await store.dispatch(startLogging() as never)
    expect(state().logging).toMatchObject({
      status: 'on',
      debugLevel: 'ApexDbgrExtension',
      busy: false
    })
    expect(state().toast.message).toMatch(/^Logging started, until /)
  })
})

describe('deleteLogs', () => {
  it("deletes only the user's logs for 'mine', confirms and reloads", async () => {
    const deleteLogsFn = vi.fn(async () => 3)
    const { store, sf, state } = setup({ sf: { deleteLogs: deleteLogsFn } })
    const progress = vi.fn()
    expect(await store.dispatch(deleteLogs('mine', progress) as never)).toBe(3)
    expect(deleteLogsFn).toHaveBeenCalledWith(
      { scope: 'user', userId: USER },
      { onProgress: progress }
    )
    expect(state().toast.message).toBe('Deleted 3 logs')
    expect(sf.recentLogs).toHaveBeenCalled()
  })

  it("passes the all scope explicitly for 'all'", async () => {
    const deleteLogsFn = vi.fn(async (scope: unknown, options: unknown) => 1)
    const { store, state } = setup({ sf: { deleteLogs: deleteLogsFn } })
    await store.dispatch(deleteLogs('all', () => {}) as never)
    expect(deleteLogsFn.mock.calls[0][0]).toEqual({ scope: 'all' })
    expect(state().toast.message).toBe('Deleted 1 log')
  })
})

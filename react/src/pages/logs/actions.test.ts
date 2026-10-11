import { describe, it, expect, vi } from 'vitest'
import { search } from './actions'

const bodies = {
  '07L000000000001AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.131 (9345678)|USER_DEBUG|[2]|DEBUG|E2E_MARKER_1700000000000\n',
  '07L000000000002AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.124 (2345678)|SOQL_EXECUTE_BEGIN|[1]|Aggregations:0|SELECT Id FROM Account\n',
  '07L000000000003AAA':
    '62.0 APEX_CODE,FINEST\n12:01:02.140 (16000000)|FATAL_ERROR|System.NullPointerException: Attempt to de-reference a null object\n'
}

const logs = Object.fromEntries(
  Object.keys(bodies).map(Id => [Id, { Id, LogUser: { Name: 'Ada Admin' } }])
)

// Runs the search thunk against the given cached bodies; the fake client
// serves the other bodies (or fails for ids in `failing`).
async function runSearch(
  term: string,
  { cached = {}, failing = [] }: { cached?: object; failing?: string[] } = {}
) {
  const dispatch = vi.fn()
  const getState = () => ({ logsPage: { logs, logBodies: cached } })
  const sf = {
    logBody: vi.fn((id: string) =>
      failing.includes(id)
        ? Promise.reject(new Error('404 : Not Found'))
        : Promise.resolve(bodies[id])
    )
  }
  await search(term)(dispatch, getState, sf)
  expect(dispatch).toHaveBeenCalledWith({ type: 'SEARCH_INIT' })
  const done = dispatch.mock.calls
    .map(([action]) => action)
    .find(a => a.type === 'SEARCH_DONE')
  return { done, sf }
}

describe('search', () => {
  it('matches log bodies ignoring case', async () => {
    const { done } = await runSearch('e2e_marker')
    expect(done.notMatchingSearchLogs).toEqual({
      '07L000000000001AAA': false,
      '07L000000000002AAA': true,
      '07L000000000003AAA': true
    })
    expect(done).toMatchObject({ found: 1, searched: 3, failed: 0 })
  })

  it('finds a term in several logs', async () => {
    const { done } = await runSearch('APEX_CODE')
    expect(done.found).toBe(3)
  })

  it('downloads only the bodies that are not cached and returns them', async () => {
    const cached = { '07L000000000003AAA': bodies['07L000000000003AAA'] }
    const { done, sf } = await runSearch('nullpointerexception', { cached })
    expect(sf.logBody.mock.calls.map(([id]) => id).sort()).toEqual([
      '07L000000000001AAA',
      '07L000000000002AAA'
    ])
    expect(done.logBodies).toEqual(bodies)
    expect(done.found).toBe(1)
  })

  it('counts logs whose body fails to download as not searched', async () => {
    const { done } = await runSearch('select id', {
      failing: ['07L000000000002AAA']
    })
    expect(done).toMatchObject({ found: 0, searched: 2, failed: 1 })
    expect(done.notMatchingSearchLogs['07L000000000002AAA']).toBe(true)
  })
})

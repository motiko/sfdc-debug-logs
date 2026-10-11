import { describe, expect, it, vi } from 'vitest'
import {
  createSalesforceClient,
  DEBUG_LEVEL_NAME,
  NO_LOG_DEBUG_LEVEL_NAME,
  soqlId,
  soqlString
} from './client'
import type { SfRequestInit } from './request'

const API = '/services/data/v62.0'
const USER = '005000000000001AAA'
const NOW = new Date('2026-01-02T03:04:05.000Z')

interface Call {
  path: string
  init: SfRequestInit
}

// A fake request function: answers each call with the first route whose
// test matches, and records every call.
function fakeSalesforce(
  routes: [(call: Call) => boolean, (call: Call) => any][]
) {
  const calls: Call[] = []
  const request = vi.fn(async (path: string, init: SfRequestInit = {}) => {
    const call = { path, init }
    calls.push(call)
    const route = routes.find(([test]) => test(call))
    if (!route)
      throw new Error(`unexpected request ${init.method || 'GET'} ${path}`)
    return route[1](call)
  })
  const sleep = vi.fn(async () => {})
  const client = createSalesforceClient(request, { now: () => NOW, sleep })
  return { client, calls, sleep }
}

const soqlOf = (call: Call) =>
  call.path.includes('/query?q=')
    ? decodeURIComponent(call.path.split('?q=')[1])
    : null
const isQuery = (pattern: RegExp) => (call: Call) =>
  pattern.test(soqlOf(call) || '')
const is = (method: string, path: string | RegExp) => (call: Call) =>
  (call.init.method || 'GET') === method &&
  (typeof path === 'string' ? call.path === path : path.test(call.path))
const records = (...items: object[]) => ({ records: items, done: true })

describe('soql literals', () => {
  it('quotes ids and refuses anything else', () => {
    expect(soqlId(USER)).toBe(`'${USER}'`)
    expect(soqlId('001000000000001')).toBe("'001000000000001'")
    expect(() => soqlId("005' OR Id != '")).toThrow(/Not a Salesforce id/)
    expect(() => soqlId(undefined)).toThrow()
  })

  it('escapes quotes and backslashes in strings', () => {
    expect(soqlString("O'Brien\\")).toBe("'O\\'Brien\\\\'")
  })
})

describe('toolingQuery', () => {
  it('encodes the query and follows nextRecordsUrl', async () => {
    const next = `${API}/tooling/query/01gxx-2000`
    const { client, calls } = fakeSalesforce([
      [
        is('GET', /\/tooling\/query\?q=/),
        () => ({ records: [{ Id: 'a' }], nextRecordsUrl: next })
      ],
      [is('GET', next), () => records({ Id: 'b' })]
    ])
    const result = await client.toolingQuery(
      "SELECT Id FROM ApexLog WHERE Operation = 'a&b' ORDER BY Id"
    )
    expect(result).toEqual([{ Id: 'a' }, { Id: 'b' }])
    expect(calls[0].path).toBe(
      `${API}/tooling/query?q=SELECT%20Id%20FROM%20ApexLog%20WHERE%20Operation%20%3D%20'a%26b'%20ORDER%20BY%20Id`
    )
  })
})

describe('logs', () => {
  it('asks for the newest logs with the filter and limit', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM ApexLog/), () => records({ Id: '07L1' })]
    ])
    await client.recentLogs(25, "WHERE Operation = 'x'")
    expect(soqlOf(calls[0])).toMatch(
      /^SELECT LogUser\.Name,.*,SystemModstamp FROM ApexLog WHERE Operation = 'x' ORDER BY LastModifiedDate DESC LIMIT 25$/
    )
  })

  it('reads a log body as text', async () => {
    const { client, calls } = fakeSalesforce([
      [is('GET', `${API}/tooling/sobjects/ApexLog/07L1/Body`), () => 'body']
    ])
    expect(await client.logBody('07L1')).toBe('body')
    expect(calls[0].init.responseType).toBe('text')
  })

  it('returns the newest log or undefined', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/LIMIT 1$/), () => records()]
    ])
    expect(await client.newestLog()).toBeUndefined()
    expect(soqlOf(calls[0])).toMatch(/ORDER BY LastModifiedDate DESC LIMIT 1$/)
  })

  it('lists key prefixes without objects that have none', async () => {
    const { client } = fakeSalesforce([
      [
        is('GET', `${API}/sobjects`),
        () => ({ sobjects: [{ keyPrefix: '001' }, {}, { keyPrefix: null }] })
      ]
    ])
    expect(await client.keyPrefixes()).toEqual(['001'])
  })
})

describe('getOrCreateDebugLevel', () => {
  it('reuses an existing debug level', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM DebugLevel/), () => records({ Id: '7dl1' })]
    ])
    expect(await client.getOrCreateDebugLevel()).toBe('7dl1')
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`
    )
    expect(calls).toHaveLength(1)
  })

  it('creates it with every category at the given level', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM DebugLevel/), () => records()],
      [
        is('POST', `${API}/tooling/sobjects/DebugLevel`),
        () => ({ id: '7dl2', success: true })
      ]
    ])
    expect(await client.getOrCreateDebugLevel('Quiet', 'NONE')).toBe('7dl2')
    expect(calls[1].init.body).toEqual({
      DeveloperName: 'Quiet',
      MasterLabel: 'Quiet',
      Language: 'en_US',
      Workflow: 'NONE',
      Validation: 'NONE',
      Callout: 'NONE',
      ApexCode: 'NONE',
      ApexProfiling: 'NONE',
      Visualforce: 'NONE',
      System: 'NONE',
      Database: 'NONE'
    })
  })
})

describe('traceUser', () => {
  const debugLevel: [(c: Call) => boolean, () => any] = [
    isQuery(/FROM DebugLevel/),
    () => records({ Id: '7dl1' })
  ]

  it('creates a 24 hour USER_DEBUG flag with the extension debug level', async () => {
    const { client, calls } = fakeSalesforce([
      debugLevel,
      [
        is('POST', `${API}/tooling/sobjects/TraceFlag`),
        () => ({ id: '7tf1', success: true })
      ]
    ])
    expect(await client.traceUser(USER)).toEqual({ id: '7tf1', success: true })
    expect(calls[1].init.body).toEqual({
      TracedEntityId: USER,
      DebugLevelId: '7dl1',
      LogType: 'USER_DEBUG',
      StartDate: '2026-01-02T03:04:05.000Z',
      ExpirationDate: '2026-01-03T03:04:05.000Z'
    })
  })

  it('replaces its own overlapping flags and retries without an expiration date', async () => {
    let posts = 0
    const { client, calls } = fakeSalesforce([
      debugLevel,
      [
        is('POST', `${API}/tooling/sobjects/TraceFlag`),
        () => {
          if (posts++ === 0) throw new Error('400: overlapping trace flag')
          return { id: '7tf2', success: true }
        }
      ],
      [
        isQuery(/FROM TraceFlag/),
        () => records({ Id: '7tfA' }, { Id: '7tfB' })
      ],
      [is('DELETE', /\/tooling\/sobjects\/TraceFlag\/7tf[AB]$/), () => null]
    ])
    expect(await client.traceUser(USER)).toEqual({ id: '7tf2', success: true })
    const flagQuery = calls.map(soqlOf).find(q => q && q.includes('TraceFlag'))
    expect(flagQuery).toBe(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${USER}' AND LogType = 'USER_DEBUG' ` +
        `AND (DebugLevel.DeveloperName IN ('ApexDbgrExtension','ApexDebugger'))`
    )
    expect(
      calls.filter(c => c.init.method === 'DELETE').map(c => c.path)
    ).toEqual([
      `${API}/tooling/sobjects/TraceFlag/7tfA`,
      `${API}/tooling/sobjects/TraceFlag/7tfB`
    ])
    const retry = calls.filter(c => c.init.method === 'POST').pop()
    expect(retry.init.body).toEqual({
      TracedEntityId: USER,
      DebugLevelId: '7dl1',
      LogType: 'USER_DEBUG',
      StartDate: '2026-01-02T03:04:05.000Z'
    })
  })

  it('refuses a user id that is not an id', async () => {
    const { client } = fakeSalesforce([debugLevel])
    await expect(client.traceUser("x' OR '1'='1")).rejects.toThrow(
      /Not a Salesforce id/
    )
  })
})

describe('isTracing', () => {
  it('looks for a flag that has not expired', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records({ Id: '7tf1' })]
    ])
    expect(await client.isTracing(USER)).toBe(true)
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${USER}' AND ExpirationDate > 2026-01-02T03:04:05.000Z`
    )
  })
})

describe('setClassLogging', () => {
  const CLASS = '01p000000000001AAA'

  it('silences a class with a NONE debug level', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM DebugLevel/), () => records()],
      [
        is('POST', `${API}/tooling/sobjects/DebugLevel`),
        () => ({ id: '7dlNone', success: true })
      ],
      [
        is('POST', `${API}/tooling/sobjects/TraceFlag`),
        () => ({ id: '7tf1', success: true })
      ]
    ])
    await client.setClassLogging(CLASS, false)
    expect(soqlOf(calls[0])).toContain(`'${NO_LOG_DEBUG_LEVEL_NAME}'`)
    expect(calls[1].init.body).toMatchObject({ ApexCode: 'NONE' })
    expect(calls[2].init.body).toMatchObject({
      TracedEntityId: CLASS,
      DebugLevelId: '7dlNone',
      LogType: 'CLASS_TRACING'
    })
  })

  it('removes the extension flags (and level-less legacy ones) to log again', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records({ Id: '7tf1' })],
      [is('DELETE', `${API}/tooling/sobjects/TraceFlag/7tf1`), () => null]
    ])
    await client.setClassLogging(CLASS, true)
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${CLASS}' AND LogType = 'CLASS_TRACING' ` +
        `AND (DebugLevel.DeveloperName IN ('ApexDbgrNoLog') OR DebugLevelId = null)`
    )
    expect(calls).toHaveLength(2)
  })
})

describe('deleteAllLogs', () => {
  const job = {
    id: '750J',
    contentUrl: 'services/data/v62.0/jobs/ingest/750J/batches'
  }

  function bulk(states: string[]) {
    return fakeSalesforce([
      [
        isQuery(/^SELECT Id FROM ApexLog$/),
        () => records({ Id: '07L1' }, { Id: '07L2' })
      ],
      [is('POST', `${API}/jobs/ingest`), () => job],
      [is('PUT', `/${job.contentUrl}`), () => null],
      [
        is('PATCH', `${API}/jobs/ingest/750J`),
        () => ({ state: 'UploadComplete' })
      ],
      [is('GET', `${API}/jobs/ingest/750J`), () => ({ state: states.shift() })]
    ])
  }

  it('runs one Bulk API 2.0 delete job and waits for it', async () => {
    const { client, calls, sleep } = bulk([
      'InProgress',
      'InProgress',
      'JobComplete'
    ])
    expect(await client.deleteAllLogs()).toBe(2)
    expect(
      calls.map(c => `${c.init.method || 'GET'} ${c.path.split('?')[0]}`)
    ).toEqual([
      `GET ${API}/tooling/query`,
      `POST ${API}/jobs/ingest`,
      `PUT /${job.contentUrl}`,
      `PATCH ${API}/jobs/ingest/750J`,
      `GET ${API}/jobs/ingest/750J`,
      `GET ${API}/jobs/ingest/750J`,
      `GET ${API}/jobs/ingest/750J`
    ])
    expect(calls[1].init.body).toMatchObject({
      object: 'ApexLog',
      operation: 'delete'
    })
    expect(calls[2].init).toMatchObject({
      headers: { 'Content-Type': 'text/csv' },
      body: 'Id\n07L1\n07L2'
    })
    expect(calls[3].init.body).toEqual({ state: 'UploadComplete' })
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('rejects when the job fails', async () => {
    const { client } = bulk(['Failed'])
    await expect(client.deleteAllLogs()).rejects.toThrow(/Failed/)
  })

  it('does nothing when there are no logs', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM ApexLog/), () => records()]
    ])
    expect(await client.deleteAllLogs()).toBe(0)
    expect(calls).toHaveLength(1)
  })
})

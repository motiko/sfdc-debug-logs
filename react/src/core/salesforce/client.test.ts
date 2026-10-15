import { describe, expect, it, vi } from 'vitest'
import {
  createSalesforceClient,
  CUSTOM_DEBUG_LEVEL_NAME,
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

describe('deleteLogs', () => {
  const job = {
    id: '750K',
    contentUrl: 'services/data/v62.0/jobs/ingest/750K/batches'
  }
  const bulkRoutes = (logQuery: RegExp): [any, any][] => [
    [isQuery(logQuery), () => records({ Id: '07L1' })],
    [is('POST', `${API}/jobs/ingest`), () => job],
    [is('PUT', `/${job.contentUrl}`), () => null],
    [is('PATCH', `${API}/jobs/ingest/750K`), () => ({})],
    [is('GET', `${API}/jobs/ingest/750K`), () => ({ state: 'JobComplete' })]
  ]

  it("deletes only the user's logs when given a user", async () => {
    const { client, calls } = fakeSalesforce(
      bulkRoutes(/^SELECT Id FROM ApexLog WHERE LogUserId = /)
    )
    const progress = []
    expect(
      await client.deleteLogs(
        { scope: 'user', userId: USER },
        { onProgress: p => progress.push(p) }
      )
    ).toBe(1)
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM ApexLog WHERE LogUserId = '${USER}'`
    )
    expect(calls[2].init.body).toBe('Id\n07L1')
    expect(progress).toEqual([
      { step: 'finding', total: null },
      { step: 'uploading', total: 1 },
      { step: 'deleting', total: 1 }
    ])
  })

  it('deletes every log of the org only for the all scope', async () => {
    const { client, calls } = fakeSalesforce(
      bulkRoutes(/^SELECT Id FROM ApexLog$/)
    )
    expect(await client.deleteLogs({ scope: 'all' })).toBe(1)
    expect(soqlOf(calls[0])).toBe('SELECT Id FROM ApexLog')
    expect(soqlOf(calls[0])).not.toContain('LogUserId')
  })

  // Fail closed: "only my logs" without a usable user id must never become
  // every user's logs, and must not send any request.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['an injection', "x' OR Id != '"],
    ['too short', '005abc']
  ])('refuses a user scope with a user id that is %s', async (_, userId) => {
    const { client, calls } = fakeSalesforce([])
    await expect(
      client.deleteLogs({ scope: 'user', userId } as never)
    ).rejects.toThrow(/Not a Salesforce id/)
    await expect(
      client.countLogs({ scope: 'user', userId } as never)
    ).rejects.toThrow(/Not a Salesforce id/)
    expect(calls).toHaveLength(0)
  })

  it('refuses a missing or unknown scope', async () => {
    const { client, calls } = fakeSalesforce([])
    await expect(client.deleteLogs(undefined as never)).rejects.toThrow(
      /Choose which logs/
    )
    await expect(client.deleteLogs({} as never)).rejects.toThrow(
      /Choose which logs/
    )
    await expect(client.deleteLogs({ userId: USER } as never)).rejects.toThrow(
      /Choose which logs/
    )
    await expect(client.countLogs(undefined as never)).rejects.toThrow(
      /Choose which logs/
    )
    expect(calls).toHaveLength(0)
  })
})

describe('countLogs', () => {
  it("counts the org's or one user's logs", async () => {
    const { client, calls } = fakeSalesforce([
      [
        isQuery(/^SELECT COUNT\(\) FROM ApexLog/),
        call => ({ totalSize: soqlOf(call).includes('LogUserId') ? 3 : 40 })
      ]
    ])
    expect(await client.countLogs({ scope: 'all' })).toBe(40)
    expect(soqlOf(calls[0])).toBe('SELECT COUNT() FROM ApexLog')
    expect(await client.countLogs({ scope: 'user', userId: USER })).toBe(3)
    expect(soqlOf(calls[1])).toBe(
      `SELECT COUNT() FROM ApexLog WHERE LogUserId = '${USER}'`
    )
  })
})

describe('logging status', () => {
  const flag = {
    Id: '7tf1',
    ExpirationDate: '2026-01-02T05:00:00.000+0000',
    DebugLevel: { DeveloperName: DEBUG_LEVEL_NAME }
  }

  it("reports the user's longest-running active flag", async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records(flag)]
    ])
    expect(await client.traceStatus(USER)).toEqual({
      active: true,
      flagId: '7tf1',
      expiresAt: flag.ExpirationDate,
      debugLevel: DEBUG_LEVEL_NAME
    })
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id, ExpirationDate, DebugLevel.DeveloperName FROM TraceFlag ` +
        `WHERE TracedEntityId = '${USER}' AND LogType = 'USER_DEBUG' ` +
        `AND ExpirationDate > 2026-01-02T03:04:05.000Z ORDER BY ExpirationDate DESC`
    )
  })

  it('reports no logging without an active flag', async () => {
    const { client } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records()]
    ])
    expect(await client.traceStatus(USER)).toEqual({ active: false })
  })

  it("stops logging by deleting the user's active flags", async () => {
    const { client, calls } = fakeSalesforce([
      [
        isQuery(/FROM TraceFlag/),
        () => records({ Id: '7tf1' }, { Id: '7tf2' })
      ],
      [is('DELETE', /TraceFlag\/7tf[12]$/), () => null]
    ])
    expect(await client.stopTracing(USER)).toBe(2)
    expect(soqlOf(calls[0])).toContain(
      `LogType = 'USER_DEBUG' AND ExpirationDate > `
    )
    expect(calls.filter(c => c.init.method === 'DELETE')).toHaveLength(2)
  })

  it('extends the active flag to 24 hours from now', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records(flag)],
      [is('PATCH', `${API}/tooling/sobjects/TraceFlag/7tf1`), () => null]
    ])
    const status = await client.extendTracing(USER)
    expect(status.active).toBe(true)
    expect(calls[1].init.body).toEqual({
      StartDate: '2026-01-02T03:04:05.000Z',
      ExpirationDate: '2026-01-03T03:04:05.000Z'
    })
  })

  it('starts logging when extending without an active flag', async () => {
    let flags = []
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records(...flags)],
      [isQuery(/FROM DebugLevel/), () => records({ Id: '7dl1' })],
      [
        is('POST', `${API}/tooling/sobjects/TraceFlag`),
        () => {
          flags = [flag]
          return { id: '7tf1', success: true }
        }
      ]
    ])
    expect((await client.extendTracing(USER)).active).toBe(true)
    expect(calls.some(c => c.init.method === 'POST')).toBe(true)
  })
})

describe('currentUser', () => {
  it('reads the user and org ids from userinfo', async () => {
    const { client } = fakeSalesforce([
      [
        is('GET', '/services/oauth2/userinfo'),
        () => ({ user_id: USER, organization_id: '00D000000000001AAA' })
      ]
    ])
    expect(await client.currentUser()).toEqual({
      userId: USER,
      orgId: '00D000000000001AAA'
    })
  })
})

describe('debug levels', () => {
  it('lists the org’s levels with their categories', async () => {
    const { client, calls } = fakeSalesforce([
      [
        isQuery(/FROM DebugLevel/),
        () =>
          records({
            Id: '7dl1',
            DeveloperName: 'SFDC_DevConsole',
            MasterLabel: 'SFDC_DevConsole',
            ApexCode: 'FINEST',
            Database: 'INFO'
          })
      ]
    ])
    expect(await client.debugLevels()).toEqual([
      {
        id: '7dl1',
        name: 'SFDC_DevConsole',
        label: 'SFDC_DevConsole',
        levels: { ApexCode: 'FINEST', Database: 'INFO' }
      }
    ])
    expect(soqlOf(calls[0])).toMatch(
      /^SELECT Id, DeveloperName, MasterLabel, ApexCode, .*, Nba FROM DebugLevel ORDER BY DeveloperName$/
    )
  })

  const levels = {
    ApexCode: 'FINEST',
    ApexProfiling: 'INFO',
    Callout: 'INFO',
    Database: 'INFO',
    System: 'DEBUG',
    Validation: 'INFO',
    Visualforce: 'INFO',
    Workflow: 'INFO',
    Wave: 'INFO',
    Nba: 'INFO'
  } as const

  it('creates the custom level with every category', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM DebugLevel/), () => records()],
      [
        is('POST', `${API}/tooling/sobjects/DebugLevel`),
        () => ({ id: '7dl9', success: true })
      ]
    ])
    expect(await client.saveCustomDebugLevel(levels)).toBe('7dl9')
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM DebugLevel WHERE DeveloperName = '${CUSTOM_DEBUG_LEVEL_NAME}'`
    )
    expect(calls[1].init.body).toEqual({
      DeveloperName: CUSTOM_DEBUG_LEVEL_NAME,
      MasterLabel: CUSTOM_DEBUG_LEVEL_NAME,
      Language: 'en_US',
      ...levels
    })
  })

  it('updates the custom level when it exists', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM DebugLevel/), () => records({ Id: '7dl9' })],
      [is('PATCH', `${API}/tooling/sobjects/DebugLevel/7dl9`), () => null]
    ])
    expect(await client.saveCustomDebugLevel(levels)).toBe('7dl9')
    expect(calls[1].init.body).toEqual(levels)
  })
})

describe('trace flags', () => {
  const CLASS = '01p000000000001AAA'
  const TRIGGER = '01q000000000001AAA'
  const LEVEL = '7dl000000000001AAA'

  it('lists active flags of every entity, with names', async () => {
    const { client, calls } = fakeSalesforce([
      [
        isQuery(/FROM TraceFlag/),
        () =>
          records(
            {
              Id: '7tf1',
              LogType: 'USER_DEBUG',
              TracedEntityId: USER,
              StartDate: '2026-01-02T03:00:00.000+0000',
              ExpirationDate: '2026-01-02T05:00:00.000+0000',
              DebugLevel: { DeveloperName: DEBUG_LEVEL_NAME }
            },
            {
              Id: '7tf2',
              LogType: 'CLASS_TRACING',
              TracedEntityId: CLASS,
              ExpirationDate: '2026-01-02T04:00:00.000+0000',
              DebugLevel: null
            },
            {
              Id: '7tf3',
              LogType: 'CLASS_TRACING',
              TracedEntityId: TRIGGER,
              ExpirationDate: '2026-01-02T04:00:00.000+0000'
            }
          )
      ],
      [
        is('GET', /\/data\/v62\.0\/query\?q=.*FROM%20User/),
        () => records({ Id: USER, Name: 'Ada Admin' })
      ],
      [
        isQuery(/FROM ApexClass/),
        () => records({ Id: CLASS, Name: 'AccountService' })
      ],
      // The trigger lookup fails: only its name is missing.
      [
        isQuery(/FROM ApexTrigger/),
        () => {
          throw new Error('403')
        }
      ]
    ])
    const flags = await client.activeTraceFlags()
    expect(soqlOf(calls[0])).toBe(
      'SELECT Id, LogType, TracedEntityId, StartDate, ExpirationDate, ' +
        'DebugLevel.DeveloperName FROM TraceFlag ' +
        'WHERE ExpirationDate > 2026-01-02T03:04:05.000Z ORDER BY ExpirationDate DESC'
    )
    expect(soqlOf(calls.find(c => /User/.test(soqlOf(c) || '')))).toBe(
      `SELECT Id, Name FROM User WHERE Id IN ('${USER}')`
    )
    expect(flags).toEqual([
      {
        id: '7tf1',
        logType: 'USER_DEBUG',
        entityId: USER,
        entityKind: 'user',
        entityName: 'Ada Admin',
        startDate: '2026-01-02T03:00:00.000+0000',
        expiresAt: '2026-01-02T05:00:00.000+0000',
        debugLevel: DEBUG_LEVEL_NAME
      },
      {
        id: '7tf2',
        logType: 'CLASS_TRACING',
        entityId: CLASS,
        entityKind: 'class',
        entityName: 'AccountService',
        startDate: null,
        expiresAt: '2026-01-02T04:00:00.000+0000',
        debugLevel: null
      },
      {
        id: '7tf3',
        logType: 'CLASS_TRACING',
        entityId: TRIGGER,
        entityKind: 'trigger',
        entityName: null,
        startDate: null,
        expiresAt: '2026-01-02T04:00:00.000+0000',
        debugLevel: null
      }
    ])
  })

  it('creates a flag for the chosen duration', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records()],
      [
        is('POST', `${API}/tooling/sobjects/TraceFlag`),
        () => ({ id: '7tf9', success: true })
      ]
    ])
    expect(
      await client.setTraceFlag({
        entityId: CLASS,
        logType: 'CLASS_TRACING',
        debugLevelId: LEVEL,
        durationMs: 3600_000
      })
    ).toEqual({ id: '7tf9', updated: false })
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${CLASS}' ` +
        `AND LogType = 'CLASS_TRACING' AND ExpirationDate > 2026-01-02T03:04:05.000Z ` +
        `ORDER BY ExpirationDate DESC`
    )
    expect(calls[1].init.body).toEqual({
      TracedEntityId: CLASS,
      LogType: 'CLASS_TRACING',
      DebugLevelId: LEVEL,
      StartDate: '2026-01-02T03:04:05.000Z',
      ExpirationDate: '2026-01-02T04:04:05.000Z'
    })
  })

  it('updates the active flag instead of creating an overlapping one', async () => {
    const { client, calls } = fakeSalesforce([
      [isQuery(/FROM TraceFlag/), () => records({ Id: '7tf1' })],
      [is('PATCH', `${API}/tooling/sobjects/TraceFlag/7tf1`), () => null]
    ])
    expect(
      await client.setTraceFlag({
        entityId: USER,
        logType: 'USER_DEBUG',
        debugLevelId: LEVEL,
        durationMs: 48 * 3600_000
      })
    ).toEqual({ id: '7tf1', updated: true })
    // At most 24 hours.
    expect(calls[1].init.body).toEqual({
      DebugLevelId: LEVEL,
      StartDate: '2026-01-02T03:04:05.000Z',
      ExpirationDate: '2026-01-03T03:04:05.000Z'
    })
    expect(calls.some(c => c.init.method === 'POST')).toBe(false)
  })

  it('refuses bad ids and log types before any request', async () => {
    const { client, calls } = fakeSalesforce([])
    await expect(
      client.setTraceFlag({
        entityId: "005' OR Id != '",
        logType: 'USER_DEBUG',
        debugLevelId: LEVEL,
        durationMs: 1
      })
    ).rejects.toThrow(/Not a Salesforce id/)
    await expect(
      client.setTraceFlag({
        entityId: USER,
        logType: 'DEVELOPER_LOG' as 'USER_DEBUG',
        debugLevelId: LEVEL,
        durationMs: 1
      })
    ).rejects.toThrow(/Unsupported/)
    await expect(client.deleteTraceFlag('x')).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('deletes one flag', async () => {
    const { client, calls } = fakeSalesforce([
      [
        is('DELETE', `${API}/tooling/sobjects/TraceFlag/7tf000000000001AAA`),
        () => null
      ]
    ])
    await client.deleteTraceFlag('7tf000000000001AAA')
    expect(calls).toHaveLength(1)
  })
})

describe('trace targets', () => {
  it('searches active users by name or username, escaping the term', async () => {
    const { client, calls } = fakeSalesforce([
      [
        is('GET', /\/data\/v62\.0\/query\?q=/),
        () =>
          records({ Id: USER, Name: 'Ada Admin', Username: 'ada@example.com' })
      ]
    ])
    expect(await client.searchUsers(" ad'a% ")).toEqual([
      { id: USER, name: 'Ada Admin', username: 'ada@example.com' }
    ])
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id, Name, Username FROM User WHERE IsActive = true ` +
        `AND (Name LIKE '%ad\\'a\\%%' OR Username LIKE '%ad\\'a\\%%') ` +
        `ORDER BY Name LIMIT 20`
    )
    expect(await client.searchUsers('  ')).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('finds the Automated Process user', async () => {
    const { client, calls } = fakeSalesforce([
      [
        is('GET', /\/data\/v62\.0\/query\?q=/),
        () =>
          records({
            Id: '005000000000009AAA',
            Name: 'Automated Process',
            Username: 'autoproc@00d'
          })
      ]
    ])
    expect(await client.automatedProcessUser()).toEqual({
      id: '005000000000009AAA',
      name: 'Automated Process',
      username: 'autoproc@00d'
    })
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id, Name, Username FROM User WHERE UserType = 'AutomatedProcess' LIMIT 1`
    )
  })

  it('has no Automated Process user when the query finds none', async () => {
    const { client } = fakeSalesforce([
      [is('GET', /\/query\?q=/), () => records()]
    ])
    expect(await client.automatedProcessUser()).toBeNull()
  })

  it('searches classes and triggers by name', async () => {
    const { client, calls } = fakeSalesforce([
      [
        isQuery(/FROM ApexClass/),
        () =>
          records(
            { Id: '01p1', Name: 'AccountService' },
            { Id: '01p2', Name: 'Util', NamespacePrefix: 'pkg' }
          )
      ],
      [
        isQuery(/FROM ApexTrigger/),
        () => records({ Id: '01q1', Name: 'AccountTrigger' })
      ]
    ])
    expect(await client.searchApexCode('acc')).toEqual([
      { id: '01p1', name: 'AccountService', kind: 'class' },
      { id: '01q1', name: 'AccountTrigger', kind: 'trigger' },
      { id: '01p2', name: 'pkg.Util', kind: 'class' }
    ])
    expect(soqlOf(calls[0])).toBe(
      `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Name LIKE '%acc%' ORDER BY Name LIMIT 20`
    )
    expect(calls[0].path).toContain('/tooling/query')
  })
})

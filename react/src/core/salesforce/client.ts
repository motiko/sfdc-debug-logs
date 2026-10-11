// The one Salesforce client of the extension: every REST, Tooling and Bulk
// API call that the app (html/app.html) and the content scripts make. It only
// builds requests and reads responses; the transport is the request function
// it is given (see request.ts), so the same calls work from a Salesforce page
// and from the extension's own page.
import { API } from './api-version'
import type { SfRequest } from './request'

const TOOLING = `${API}/tooling`

// Debug level of the trace flags this extension creates for users ("Start
// Logging" in the app, "Add Current User" on the classic log list): DEBUG for
// every category.
export const DEBUG_LEVEL_NAME = 'ApexDbgrExtension'
// The level "Add Current User" created before both used DEBUG_LEVEL_NAME. Its
// flags count as the extension's own when an overlapping flag is replaced.
export const LEGACY_DEBUG_LEVEL_NAME = 'ApexDebugger'
// Debug level of the class trace flags set by "Dont Log Class" on the class
// list: NONE for every category, which silences the class.
export const NO_LOG_DEBUG_LEVEL_NAME = 'ApexDbgrNoLog'

const LOG_CATEGORIES = [
  'Workflow',
  'Validation',
  'Callout',
  'ApexCode',
  'ApexProfiling',
  'Visualforce',
  'System',
  'Database'
]

// Salesforce allows trace flags of at most 24 hours.
const TRACE_MS = 24 * 60 * 60 * 1000

export const APEX_LOG_FIELDS = [
  'LogUser.Name',
  'Application',
  'DurationMilliseconds',
  'Id',
  'LastModifiedDate',
  'Location',
  'LogLength',
  'LogUserId',
  'Operation',
  'Request',
  'StartTime',
  'Status',
  'SystemModstamp'
]

export interface ApexLogRecord {
  Id: string
  LogUser?: { Name: string }
  LogUserId?: string
  Application?: string
  DurationMilliseconds?: number
  LastModifiedDate?: string
  Location?: string
  LogLength?: number
  Operation?: string
  Request?: string
  StartTime?: string
  Status?: string
  SystemModstamp?: string
}

export interface SaveResult {
  id: string
  success: boolean
  errors?: unknown[]
}

export interface ClientOptions {
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  // How often and how long "delete all logs" polls its Bulk API job.
  pollIntervalMs?: number
  pollTimeoutMs?: number
}

// A Salesforce record id as a SOQL literal. Ids come from cookies and URL
// parameters, so anything that isn't an id is refused rather than quoted.
export function soqlId(id: string): string {
  if (!/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(id || '')) {
    throw new Error(`Not a Salesforce id: ${id}`)
  }
  return `'${id}'`
}

export function soqlString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

export function createSalesforceClient(
  request: SfRequest,
  {
    now = () => new Date(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    pollIntervalMs = 1000,
    pollTimeoutMs = 10 * 60 * 1000
  }: ClientOptions = {}
) {
  // All records of a Tooling API query, following nextRecordsUrl.
  async function toolingQuery<T = any>(soql: string): Promise<T[]> {
    let page = await request(`${TOOLING}/query?q=${encodeURIComponent(soql)}`)
    const records: T[] = [...page.records]
    while (page.nextRecordsUrl) {
      page = await request(page.nextRecordsUrl)
      records.push(...page.records)
    }
    return records
  }

  function logBody(logId: string): Promise<string> {
    return request(
      `${TOOLING}/sobjects/ApexLog/${encodeURIComponent(logId)}/Body`,
      { responseType: 'text' }
    )
  }

  // The newest logs of the org, newest first. where: a SOQL WHERE clause
  // ("WHERE Operation = '…'") or ''.
  function recentLogs(limit = 50, where = ''): Promise<ApexLogRecord[]> {
    const count = Math.max(1, Math.floor(Number(limit)) || 1)
    return toolingQuery(
      `SELECT ${APEX_LOG_FIELDS.join(',')} FROM ApexLog ${where} ` +
        `ORDER BY LastModifiedDate DESC LIMIT ${count}`
    )
  }

  async function newestLog(): Promise<ApexLogRecord | undefined> {
    const [log] = await recentLogs(1)
    return log
  }

  // The 3-character key prefixes of the org's objects, to tell record ids
  // from other 15/18-character words in a log.
  async function keyPrefixes(): Promise<string[]> {
    const { sobjects } = await request(`${API}/sobjects`)
    return sobjects
      .map((sobject: { keyPrefix?: string }) => sobject.keyPrefix)
      .filter((prefix: string | undefined) => prefix)
  }

  // The id of the debug level with this name, created with `level` for every
  // category if the org has none.
  async function getOrCreateDebugLevel(
    name = DEBUG_LEVEL_NAME,
    level: 'DEBUG' | 'NONE' = 'DEBUG'
  ): Promise<string> {
    const [existing] = await toolingQuery<{ Id: string }>(
      `SELECT Id FROM DebugLevel WHERE DeveloperName = ${soqlString(name)}`
    )
    if (existing) return existing.Id
    const created: SaveResult = await request(
      `${TOOLING}/sobjects/DebugLevel`,
      {
        method: 'POST',
        body: {
          DeveloperName: name,
          MasterLabel: name,
          Language: 'en_US',
          ...Object.fromEntries(LOG_CATEGORIES.map(c => [c, level]))
        }
      }
    )
    return created.id
  }

  // Whether the user (or class) has a trace flag that hasn't expired.
  async function isTracing(entityId: string): Promise<boolean> {
    const flags = await toolingQuery(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = ${soqlId(entityId)} ` +
        `AND ExpirationDate > ${now().toISOString()}`
    )
    return flags.length > 0
  }

  // Deletes the entity's trace flags of this log type whose debug level is
  // one of debugLevelNames (null: a flag without a debug level, as old
  // versions of the extension created).
  async function removeTraceFlags(
    entityId: string,
    logType: string,
    debugLevelNames: (string | null)[]
  ): Promise<number> {
    const names = debugLevelNames.filter(n => n !== null)
    const levelConditions = [
      names.length
        ? `DebugLevel.DeveloperName IN (${names.map(soqlString).join(',')})`
        : null,
      debugLevelNames.includes(null) ? 'DebugLevelId = null' : null
    ].filter(Boolean)
    const flags = await toolingQuery<{ Id: string }>(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = ${soqlId(entityId)} ` +
        `AND LogType = ${soqlString(logType)} AND (${levelConditions.join(' OR ')})`
    )
    await Promise.all(
      flags.map(flag =>
        request(`${TOOLING}/sobjects/TraceFlag/${flag.Id}`, {
          method: 'DELETE'
        })
      )
    )
    return flags.length
  }

  // Traces the entity for 24 hours from now. If Salesforce refuses (usually
  // an overlapping flag of the same log type), removes the extension's own
  // flags for the entity and retries without an expiration date, so
  // Salesforce applies its default (also 24 hours).
  async function createTraceFlag(
    entityId: string,
    logType: string,
    debugLevelId: string,
    ownDebugLevelNames: (string | null)[]
  ): Promise<SaveResult> {
    soqlId(entityId)
    const payload = {
      TracedEntityId: entityId,
      DebugLevelId: debugLevelId,
      LogType: logType
    }
    const start = now()
    try {
      return await request(`${TOOLING}/sobjects/TraceFlag`, {
        method: 'POST',
        body: {
          ...payload,
          StartDate: start.toISOString(),
          ExpirationDate: new Date(start.getTime() + TRACE_MS).toISOString()
        }
      })
    } catch {
      await removeTraceFlags(entityId, logType, ownDebugLevelNames)
      return request(`${TOOLING}/sobjects/TraceFlag`, {
        method: 'POST',
        body: { ...payload, StartDate: now().toISOString() }
      })
    }
  }

  // Logs the user's activity for 24 hours (debug level DEBUG_LEVEL_NAME).
  async function traceUser(userId: string): Promise<SaveResult> {
    const debugLevelId = await getOrCreateDebugLevel(DEBUG_LEVEL_NAME)
    return createTraceFlag(userId, 'USER_DEBUG', debugLevelId, [
      DEBUG_LEVEL_NAME,
      LEGACY_DEBUG_LEVEL_NAME
    ])
  }

  // "Dont Log Class": silences a class or trigger for 24 hours with a
  // CLASS_TRACING flag at NONE, or removes that flag again.
  async function setClassLogging(
    classId: string,
    enabled: boolean
  ): Promise<void> {
    const ownLevels = [NO_LOG_DEBUG_LEVEL_NAME, null]
    if (enabled) {
      await removeTraceFlags(classId, 'CLASS_TRACING', ownLevels)
      return
    }
    const debugLevelId = await getOrCreateDebugLevel(
      NO_LOG_DEBUG_LEVEL_NAME,
      'NONE'
    )
    await createTraceFlag(classId, 'CLASS_TRACING', debugLevelId, ownLevels)
  }

  // Deletes every debug log of the org with one Bulk API 2.0 job, and
  // resolves with the number of logs once the job completes.
  async function deleteAllLogs(): Promise<number> {
    const logs = await toolingQuery<{ Id: string }>('SELECT Id FROM ApexLog')
    if (logs.length === 0) return 0
    const csv = ['Id', ...logs.map(log => log.Id)].join('\n')
    const job = await request(`${API}/jobs/ingest`, {
      method: 'POST',
      body: {
        object: 'ApexLog',
        operation: 'delete',
        contentType: 'CSV',
        lineEnding: 'LF'
      }
    })
    await request(`/${job.contentUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/csv' },
      body: csv
    })
    await request(`${API}/jobs/ingest/${job.id}`, {
      method: 'PATCH',
      body: { state: 'UploadComplete' }
    })
    const deadline = now().getTime() + pollTimeoutMs
    for (;;) {
      const { state, errorMessage } = await request(
        `${API}/jobs/ingest/${job.id}`
      )
      if (state === 'JobComplete') return logs.length
      if (state === 'Failed' || state === 'Aborted') {
        throw new Error(
          `Deleting logs failed: ${state}${errorMessage ? ` (${errorMessage})` : ''}`
        )
      }
      if (now().getTime() > deadline) {
        throw new Error(`Deleting logs timed out (job ${job.id}: ${state})`)
      }
      await sleep(pollIntervalMs)
    }
  }

  return {
    request,
    toolingQuery,
    logBody,
    recentLogs,
    newestLog,
    keyPrefixes,
    getOrCreateDebugLevel,
    isTracing,
    removeTraceFlags,
    traceUser,
    setClassLogging,
    deleteAllLogs
  }
}

export type SalesforceClient = ReturnType<typeof createSalesforceClient>

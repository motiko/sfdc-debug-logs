// A fake Salesforce org for offline runs of the e2e flow and the UX audit:
// the REST, Tooling and Bulk API 2.0 calls the extension and the e2e helpers
// make (react/src/core/salesforce/client.ts, e2e/lib/salesforce.mjs), on an
// in-memory org with one user, debug logs, debug levels and trace flags.
// Anonymous Apex runs through mock/apex.mjs and writes a real-looking log.
//
// handle(request) is the whole API: mock/server.mjs serves it over HTTPS to
// the browser, and fetch() calls it in-process for Node. Every request is
// counted (stats()), by source and kind, so runs can report how many
// Salesforce API requests they'd make.

import { runAnonymousApex } from './apex.mjs'
import { API_VERSION } from '../../scripts/lib/sf-auth.mjs'

export const MOCK_DOMAIN = 'apexdbgr-mock'
export const MOCK_HOSTS = {
  // The API and classic pages.
  api: `${MOCK_DOMAIN}.my.salesforce.com`,
  // Lightning Experience and Lightning Setup.
  lightning: `${MOCK_DOMAIN}.lightning.force.com`,
  setup: `${MOCK_DOMAIN}.my.salesforce-setup.com`
}

let idCounter = 100
// A Salesforce-looking 18-character id with this key prefix.
export function mockId(prefix) {
  idCounter++
  return `${prefix}MK0${String(idCounter).padStart(9, '0')}AAA`
}

const json = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json;charset=UTF-8' },
  body: JSON.stringify(body)
})
const text = (status, body, type = 'text/plain;charset=UTF-8') => ({
  status,
  headers: { 'content-type': type },
  body
})
const sfError = (status, errorCode, message) => json(status, [{ errorCode, message }])

// The kind of a request, for the counts: what Salesforce would charge it to.
export function requestKind(method, path) {
  if (path.startsWith('/services/Soap/')) return 'soap login'
  if (path.startsWith('/services/oauth2/userinfo')) return 'userinfo'
  if (/\/tooling\/query/.test(path)) return 'tooling query'
  if (/\/tooling\/sobjects\/ApexLog\/[^/]+\/Body/.test(path)) return 'log body'
  if (/\/tooling\/executeAnonymous/.test(path)) return 'execute anonymous'
  if (/\/tooling\/sobjects\//.test(path)) return `tooling ${method}`
  if (/\/jobs\/ingest/.test(path)) return 'bulk api 2.0'
  if (/\/services\/data\/v[\d.]+\/sobjects\/?$/.test(path)) return 'describe global'
  if (/\/services\/data\/v[\d.]+\/sobjects\//.test(path)) return `rest ${method}`
  if (path.startsWith('/services/data')) return 'rest other'
  return null
}

// Salesforce API requests count against the org's daily limit; SOAP login and
// userinfo don't (but login is rate limited, and fails once the limit is hit).
export const COUNTS_AGAINST_LIMIT = kind => kind && kind !== 'soap login' && kind !== 'userinfo'

function parseLiteral(raw) {
  const value = raw.trim()
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/\\(.)/g, '$1')
  if (value.toLowerCase() === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (/^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).getTime()
  return value
}

// One condition: Field op value, Field IN (...), (a OR b).
function condition(record, cond, get) {
  cond = cond.trim()
  if (cond.startsWith('(') && cond.endsWith(')')) {
    return cond
      .slice(1, -1)
      .split(/\s+OR\s+/i)
      .some(c => condition(record, c, get))
  }
  const inMatch = /^([\w.]+)\s+IN\s*\((.*)\)$/i.exec(cond)
  if (inMatch) {
    const values = inMatch[2].split(',').map(parseLiteral)
    return values.includes(get(record, inMatch[1]))
  }
  const m = /^([\w.]+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/.exec(cond)
  if (!m) throw new Error(`mock SOQL: can't read condition ${cond}`)
  let actual = get(record, m[1])
  const expected = parseLiteral(m[3])
  if (typeof expected === 'number' && typeof actual === 'string' && /^\d{4}-/.test(actual)) {
    actual = new Date(actual).getTime()
  }
  switch (m[2]) {
    case '=':
      return actual === expected
    case '!=':
      return actual !== expected
    case '>=':
      return actual >= expected
    case '<=':
      return actual <= expected
    case '>':
      return actual > expected
    case '<':
      return actual < expected
  }
}

export class MockOrg {
  constructor({ apiVersion = API_VERSION } = {}) {
    this.apiVersion = apiVersion
    this.orgId = '00DMK0000000001AAA'
    this.sessionId = `00DMOCK!mock-session-${Math.random().toString(36).slice(2)}`
    this.user = {
      Id: '005MK0000000001AAA',
      Name: 'Mock Developer',
      Username: 'developer@apexdbgr-mock.example',
      IsActive: true,
      UserPreferencesLightningExperiencePreferred: false
    }
    this.otherUser = { Id: '005MK0000000002AAA', Name: 'Other Developer' }
    this.accounts = [
      { Id: '001MK0000000001AAA', Name: 'Acme', CreatedDate: '2026-10-01T10:00:00.000+0000' },
      { Id: '001MK0000000002AAA', Name: 'Globex', CreatedDate: '2026-10-02T10:00:00.000+0000' }
    ]
    this.logs = []
    this.bodies = new Map()
    this.debugLevels = []
    this.traceFlags = []
    this.jobs = new Map()
    this.requests = []
    // Optional delay (ms) per path pattern, e.g. to hold the frontdoor
    // redirect to Lightning: [{ pattern: /\/lightning\//, ms: 70000, times: 1 }].
    this.delays = []
    this.addSeedLogs()
  }

  // A few logs that exist before the run, one of another user.
  addSeedLogs() {
    const start = Date.now() - 3600_000
    const seed = [
      { user: this.user, operation: '/apex/AccountPage', status: 'Success', apex: "System.debug('page load');" },
      {
        user: this.otherUser,
        operation: 'BatchApexWorker',
        status: 'System.LimitException: Too many SOQL queries: 101',
        apex: "System.debug('batch');"
      },
      { user: this.user, operation: '/aura', status: 'Success', apex: "System.debug('aura action');" }
    ]
    seed.forEach((s, i) => {
      const { log } = runAnonymousApex(s.apex, { user: { ...this.user, ...s.user }, data: {} })
      this.addLog({
        user: s.user,
        body: log,
        operation: s.operation,
        status: s.status,
        start: new Date(start + i * 60_000),
        durationMs: 40 + i * 7
      })
    })
  }

  addLog({ user = this.user, body, operation, status = 'Success', start = new Date(), durationMs = 25 }) {
    const id = mockId('07L')
    const iso = start.toISOString().replace('Z', '+0000')
    this.logs.push({
      Id: id,
      LogUserId: user.Id,
      LogUser: { Name: user.Name },
      Application: 'Unknown',
      DurationMilliseconds: durationMs,
      LastModifiedDate: iso,
      Location: 'Monitoring',
      LogLength: Buffer.byteLength(body),
      Operation: operation,
      Request: 'Api',
      StartTime: iso,
      Status: status,
      SystemModstamp: iso
    })
    this.bodies.set(id, body)
    return id
  }

  // --- counting --------------------------------------------------------------

  record(source, method, path) {
    const kind = requestKind(method, path)
    if (kind) this.requests.push({ source, method, path, kind, at: Date.now() })
    return kind
  }

  stats() {
    const bySource = {}
    const byKind = {}
    let api = 0
    for (const r of this.requests) {
      bySource[r.source] = (bySource[r.source] || 0) + 1
      byKind[r.kind] = (byKind[r.kind] || 0) + 1
      if (COUNTS_AGAINST_LIMIT(r.kind)) api++
    }
    return { total: this.requests.length, apiRequests: api, bySource, byKind }
  }

  // --- API -------------------------------------------------------------------

  // request: { method, url (path + query), headers (lower-case keys), body
  // (string), source ('browser' | 'node') }. Resolves { status, headers, body }.
  async handle({ method = 'GET', url, headers = {}, body = '', source = 'browser' }) {
    const parsed = new URL(url, 'https://mock')
    const path = parsed.pathname
    this.record(source, method, path)
    const auth = headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (path.startsWith('/services/') && !path.startsWith('/services/Soap/')) {
      if (token !== this.sessionId) {
        return sfError(401, 'INVALID_SESSION_ID', 'Session expired or invalid')
      }
    }
    if (path === '/services/oauth2/userinfo') {
      return json(200, {
        user_id: this.user.Id,
        organization_id: this.orgId,
        name: this.user.Name,
        preferred_username: this.user.Username
      })
    }
    const data = /^\/services\/data\/v([\d.]+)(\/.*)?$/.exec(path)
    if (!data) return null
    const rest = data[2] || '/'
    const payload = body && /json/.test(headers['content-type'] || '') ? JSON.parse(body) : body
    try {
      return this.api(method, rest, parsed.searchParams, payload)
    } catch (e) {
      return sfError(400, 'MALFORMED_QUERY', e.message)
    }
  }

  api(method, path, params, body) {
    let m
    if (method === 'GET' && path === '/tooling/query') return json(200, this.query(params.get('q')))
    if (method === 'GET' && path === '/query') return json(200, this.query(params.get('q')))
    if (method === 'GET' && path === '/sobjects') {
      return json(200, {
        sobjects: ['001', '003', '005', '006', '00D', '00Q', '01p', '07L', '7tf', '7dl', 'a00'].map(keyPrefix => ({
          keyPrefix,
          name: `Object${keyPrefix}`
        }))
      })
    }
    if ((m = /^\/tooling\/sobjects\/ApexLog\/([^/]+)\/Body$/.exec(path))) {
      const logBody = this.bodies.get(m[1])
      if (logBody === undefined) return sfError(404, 'NOT_FOUND', 'The requested resource does not exist')
      return text(200, logBody)
    }
    if (path === '/tooling/executeAnonymous' || path === '/tooling/executeAnonymous/') {
      return json(200, this.executeAnonymous(params.get('anonymousBody') || ''))
    }
    if ((m = /^\/tooling\/sobjects\/(DebugLevel|TraceFlag)(?:\/([^/]+))?$/.exec(path))) {
      return this.toolingRecord(method, m[1], m[2], body)
    }
    if ((m = /^\/sobjects\/User\/([^/?]+)$/.exec(path))) {
      if (m[1] !== this.user.Id) return sfError(404, 'NOT_FOUND', 'no such user')
      if (method === 'PATCH') {
        Object.assign(this.user, body)
        return { status: 204, headers: {}, body: '' }
      }
      const fields = (params.get('fields') || 'Id,Name').split(',')
      return json(200, Object.fromEntries(fields.map(f => [f, this.user[f]])))
    }
    if (method === 'POST' && path === '/jobs/ingest') {
      const id = mockId('750')
      this.jobs.set(id, { id, state: 'Open', object: body.object, operation: body.operation, ids: [] })
      return json(200, { id, contentUrl: `services/data/v${this.apiVersion}/jobs/ingest/${id}/batches`, state: 'Open' })
    }
    if ((m = /^\/jobs\/ingest\/([^/]+)(\/batches)?$/.exec(path))) {
      const job = this.jobs.get(m[1])
      if (!job) return sfError(404, 'NOT_FOUND', 'no such job')
      if (m[2] && method === 'PUT') {
        job.ids = String(body).split('\n').slice(1).filter(Boolean)
        return { status: 201, headers: {}, body: '' }
      }
      if (method === 'PATCH') {
        job.state = body.state
        if (body.state === 'UploadComplete') {
          const remove = new Set(job.ids)
          this.logs = this.logs.filter(l => !remove.has(l.Id))
          job.state = 'JobComplete'
        }
        return json(200, { id: job.id, state: job.state })
      }
      return json(200, { id: job.id, state: job.state, numberRecordsProcessed: job.ids.length })
    }
    return sfError(404, 'NOT_FOUND', `mock org: no handler for ${method} ${path}`)
  }

  executeAnonymous(apex) {
    const start = new Date()
    const result = runAnonymousApex(apex, {
      user: this.user,
      data: { User: [this.user], Account: this.accounts },
      start
    })
    const tracing = this.traceFlags.some(
      f => f.TracedEntityId === this.user.Id && new Date(f.ExpirationDate).getTime() > Date.now()
    )
    if (tracing) {
      this.addLog({
        body: result.log,
        operation: `/services/data/v${this.apiVersion}/tooling/executeAnonymous/`,
        status: result.success ? 'Success' : result.exceptionMessage,
        start,
        durationMs: Math.max(1, result.durationMs)
      })
    }
    return {
      line: result.line,
      column: result.success ? -1 : 1,
      compiled: true,
      success: result.success,
      compileProblem: null,
      exceptionStackTrace: result.success ? null : `AnonymousBlock: line ${result.line}, column 1`,
      exceptionMessage: result.exceptionMessage
    }
  }

  toolingRecord(method, object, id, body) {
    const table = object === 'DebugLevel' ? this.debugLevels : this.traceFlags
    if (method === 'POST') {
      if (object === 'TraceFlag') {
        const start = new Date(body.StartDate || Date.now()).getTime()
        const end = body.ExpirationDate ? new Date(body.ExpirationDate).getTime() : start + 24 * 3600_000
        if (end - start > 24 * 3600_000 + 60_000) {
          return sfError(400, 'FIELD_INTEGRITY_EXCEPTION', 'The trace flag can be at most 24 hours')
        }
        const overlapping = this.traceFlags.some(
          f =>
            f.TracedEntityId === body.TracedEntityId &&
            f.LogType === body.LogType &&
            new Date(f.ExpirationDate).getTime() > Date.now()
        )
        if (overlapping) {
          return sfError(400, 'FIELD_INTEGRITY_EXCEPTION', 'This entity is already traced.')
        }
        body = { ...body, StartDate: new Date(start).toISOString(), ExpirationDate: new Date(end).toISOString() }
      }
      const record = { Id: mockId(object === 'DebugLevel' ? '7dl' : '7tf'), ...body }
      table.push(record)
      return json(201, { id: record.Id, success: true, errors: [] })
    }
    const index = table.findIndex(r => r.Id === id)
    if (index < 0) return sfError(404, 'NOT_FOUND', `no ${object} ${id}`)
    if (method === 'DELETE') {
      table.splice(index, 1)
      return { status: 204, headers: {}, body: '' }
    }
    if (method === 'PATCH') {
      Object.assign(table[index], body)
      return { status: 204, headers: {}, body: '' }
    }
    return json(200, table[index])
  }

  // SELECT fields FROM ApexLog|DebugLevel|TraceFlag|User [WHERE …]
  // [ORDER BY f [DESC]] [LIMIT n], and SELECT COUNT() FROM ….
  query(soql) {
    const m =
      /^SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?\s*$/i.exec(
        soql.trim()
      )
    if (!m) throw new Error(`mock SOQL: can't read ${soql}`)
    const [, fieldList, object, where, orderBy, direction, limit] = m
    const tables = {
      ApexLog: this.logs,
      DebugLevel: this.debugLevels,
      TraceFlag: this.traceFlags,
      User: [this.user]
    }
    if (!tables[object]) throw new Error(`mock SOQL: no ${object}`)
    const get = (record, field) => {
      if (object === 'TraceFlag' && field.startsWith('DebugLevel.')) {
        const level = this.debugLevels.find(l => l.Id === record.DebugLevelId)
        return level ? level[field.split('.')[1]] : null
      }
      if (field === 'DebugLevelId') return record.DebugLevelId ?? null
      return field.split('.').reduce((v, k) => (v == null ? v : v[k]), record)
    }
    let rows = tables[object].filter(record => (where ? splitAnd(where).every(c => condition(record, c, get)) : true))
    if (/^COUNT\(\)$/i.test(fieldList.trim())) {
      return { totalSize: rows.length, done: true, records: [] }
    }
    if (orderBy) {
      const sign = /DESC/i.test(direction || '') ? -1 : 1
      rows = [...rows].sort((a, b) => (String(get(a, orderBy)) > String(get(b, orderBy)) ? sign : -sign))
    }
    if (limit) rows = rows.slice(0, Number(limit))
    const fields = fieldList.split(',').map(f => f.trim())
    const records = rows.map(record => {
      const out = { attributes: { type: object } }
      for (const field of fields) {
        if (field.includes('.')) {
          const [rel, sub] = field.split('.')
          if (object === 'TraceFlag' && rel === 'DebugLevel') {
            out.DebugLevel = { DeveloperName: get(record, field) }
          } else {
            out[rel] = { ...(out[rel] || {}), [sub]: get(record, field) }
          }
        } else out[field] = get(record, field)
      }
      return out
    })
    return { totalSize: records.length, done: true, records }
  }

  // Node's fetch for this org (the e2e helpers): the same handler, no network.
  fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]))
    const response =
      (await this.handle({
        method: init.method || 'GET',
        url: url.pathname + url.search,
        headers,
        body: init.body || '',
        source: 'node'
      })) || text(404, 'not found')
    return new Response(response.status === 204 ? null : response.body, {
      status: response.status,
      headers: response.headers
    })
  }
}

// "a AND b AND (c OR d)" -> ["a", "b", "(c OR d)"], keeping parentheses and
// quoted strings whole.
function splitAnd(where) {
  const parts = []
  let depth = 0
  let quote = false
  let start = 0
  for (let i = 0; i < where.length; i++) {
    const c = where[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === "'") quote = false
      continue
    }
    if (c === "'") quote = true
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && /^\sAND\s/i.test(where.slice(i, i + 5))) {
      parts.push(where.slice(start, i))
      start = i + 5
      i += 4
    }
  }
  parts.push(where.slice(start))
  return parts.map(p => p.trim()).filter(Boolean)
}

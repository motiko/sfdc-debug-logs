// Minimal Salesforce REST/Tooling client for the e2e flow.

import { API_VERSION } from '../../scripts/lib/sf-auth.mjs'

// Same debug level the extension creates from "Start Logging"
// (react/src/core/salesforce/client.ts), so the flow mirrors what users get.
const DEBUG_LEVEL_NAME = 'ApexDbgrExtension'

export class Salesforce {
  // relogin: resolves a new session, used once when Salesforce says the
  // session is invalid (a reused session that expired).
  constructor(session, { relogin = null } = {}) {
    this.useSession(session)
    this.relogin = relogin
  }

  useSession(session) {
    this.session = session
    const { instance, sessionId, userId, orgId } = session
    Object.assign(this, { instance, sessionId, userId, orgId })
  }

  async request(path, options = {}) {
    try {
      return await this.send(path, options)
    } catch (e) {
      if (!this.relogin || !/-> 401:/.test(e.message)) throw e
      this.useSession(await this.relogin())
      this.relogin = null
      return this.send(path, options)
    }
  }

  async send(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${this.instance}/services/data/v${API_VERSION}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.sessionId}`,
        'Content-Type': 'application/json'
      },
      body: body && JSON.stringify(body)
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
    const type = res.headers.get('content-type') || ''
    return type.startsWith('application/json') && text ? JSON.parse(text) : text
  }

  // The user's "Switch to Lightning Experience" setting.
  async lightningPreferred() {
    const user = await this.request(`/sobjects/User/${this.userId}?fields=UserPreferencesLightningExperiencePreferred`)
    return user.UserPreferencesLightningExperiencePreferred
  }

  async setLightningPreferred(value) {
    await this.request(`/sobjects/User/${this.userId}`, {
      method: 'PATCH',
      body: { UserPreferencesLightningExperiencePreferred: value }
    })
  }

  async query(soql) {
    const { records } = await this.request(`/tooling/query?q=${encodeURIComponent(soql)}`)
    return records
  }

  async ensureDebugLevel() {
    const [existing] = await this.query(`SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`)
    if (existing) return existing.Id
    const { id } = await this.request('/tooling/sobjects/DebugLevel', {
      method: 'POST',
      body: {
        DeveloperName: DEBUG_LEVEL_NAME,
        MasterLabel: DEBUG_LEVEL_NAME,
        Language: 'en_US',
        Workflow: 'DEBUG',
        Validation: 'DEBUG',
        Callout: 'DEBUG',
        ApexCode: 'DEBUG',
        ApexProfiling: 'DEBUG',
        Visualforce: 'DEBUG',
        System: 'DEBUG',
        Database: 'DEBUG'
      }
    })
    return id
  }

  // Makes sure the current user has an active trace flag, so Apex runs
  // produce logs. An existing active flag is left as is.
  async ensureLogging(minutes = 60) {
    const now = new Date().toISOString()
    const active = await this.query(
      `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${this.userId}' ` +
        `AND LogType IN ('USER_DEBUG', 'DEVELOPER_LOG') AND ExpirationDate > ${now}`
    )
    if (active.length) return active[0].Id
    const { id } = await this.request('/tooling/sobjects/TraceFlag', {
      method: 'POST',
      body: {
        TracedEntityId: this.userId,
        DebugLevelId: await this.ensureDebugLevel(),
        LogType: 'USER_DEBUG',
        StartDate: now,
        ExpirationDate: new Date(Date.now() + minutes * 60000).toISOString()
      }
    })
    return id
  }

  async executeAnonymous(apex) {
    const result = await this.request(`/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apex)}`)
    if (!result.compiled) throw new Error(`Apex compile error: ${result.compileProblem}`)
    if (!result.success) throw new Error(`Apex failed: ${result.exceptionMessage}`)
    return result
  }

  logBody(logId) {
    return this.request(`/tooling/sobjects/ApexLog/${logId}/Body`)
  }

  // Polls the current user's newest logs until one contains `marker`.
  async findLog(marker, options) {
    return (await this.findLogs([marker], options))[marker]
  }

  // Polls the current user's newest logs until each marker is found in one.
  // Downloads each log's body once, for all markers (finding the markers one
  // by one downloaded the same bodies again for each).
  async findLogs(markers, { since, timeoutMs = 60000 } = {}) {
    const deadline = Date.now() + timeoutMs
    const checked = new Set()
    const found = {}
    while (Date.now() < deadline) {
      const logs = await this.query(
        `SELECT Id, Operation, LogLength, StartTime FROM ApexLog ` +
          `WHERE LogUserId = '${this.userId}' AND StartTime >= ${since.toISOString()} ` +
          `ORDER BY StartTime DESC LIMIT 10`
      )
      for (const log of logs.filter(l => !checked.has(l.Id))) {
        checked.add(log.Id)
        const body = await this.logBody(log.Id)
        for (const marker of markers) {
          if (!found[marker] && body.includes(marker)) found[marker] = { ...log, body }
        }
      }
      if (markers.every(m => found[m])) return found
      await new Promise(r => setTimeout(r, 2000))
    }
    const missing = markers.filter(m => !found[m])
    throw new Error(`No ApexLog containing ${missing.join(', ')} within ${timeoutMs}ms`)
  }
}

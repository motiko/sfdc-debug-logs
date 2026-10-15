// Salesforce credentials and login shared by scripts/sf-login.mjs and e2e/.
//
// Credentials come from .env.local (or the process environment, which wins).
// Each org logs in one of three ways, the first that its keys allow:
//   1. SF_ACCESS_TOKEN + SF_INSTANCE_URL: an existing session (e.g. from
//      `sf org display`), no login.
//   2. OAuth 2.0 JWT bearer flow (scripts/lib/sf-jwt.mjs,
//      docs/e2e-jwt-setup.md): SF_USER, SF_CLIENT_ID, SF_JWT_KEY_FILE (or
//      SF_JWT_KEY), optional SF_LOGIN_URL and SF_JWT_AUDIENCE.
//   3. SOAP login() (deprecated: Salesforce retires it in Summer '27): SF_USER,
//      SF_PASS, SF_TOKEN (security token; may be empty from a trusted IP).
// SF_LOGIN_URL defaults to https://login.salesforce.com
// (https://test.salesforce.com for sandboxes, or the org's My Domain URL).
//
// Further orgs are numbered: SF_USER_2, SF_CLIENT_ID_2, SF_JWT_KEY_FILE_2 (or
// SF_PASS_2, SF_TOKEN_2), SF_LOGIN_URL_2, ... (or SF_ACCESS_TOKEN_2 +
// SF_INSTANCE_URL_2), then _3 and so on. login() takes
// the first org that logs in and still has at least SF_MIN_API_REQUESTS
// (default 500) of its daily API requests left, so a second org keeps the
// e2e flow running when the first one hits its daily limit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { jwtLogin, usesJwt } from './sf-jwt.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const API_VERSION = '62.0'

export function loadEnv(file = join(ROOT, '.env.local')) {
  const env = {}
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('SF_')) env[key] = process.env[key]
  }
  return env
}

const xmlEscape = s => s.replace(/[<>&'"]/g, c => `&#${c.charCodeAt(0)};`)

async function soapLogin({ SF_USER, SF_PASS, SF_TOKEN = '', SF_LOGIN_URL }) {
  if (!SF_USER || !SF_PASS) {
    throw new Error('SOAP login needs SF_USER and SF_PASS; better, set up the JWT bearer flow (docs/e2e-jwt-setup.md)')
  }
  const loginUrl = (SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '')
  const body = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <env:Body><urn:login>
    <urn:username>${xmlEscape(SF_USER)}</urn:username>
    <urn:password>${xmlEscape(SF_PASS + SF_TOKEN)}</urn:password>
  </urn:login></env:Body>
</env:Envelope>`
  const res = await fetch(`${loginUrl}/services/Soap/u/${API_VERSION}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: 'login' },
    body
  })
  const xml = await res.text()
  const tag = name => (xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1]
  if (!res.ok) throw new Error(`Salesforce login failed: ${tag('faultstring') || res.status}`)
  if (tag('passwordExpired') === 'true') {
    throw new Error('Salesforce password expired; change it and update .env.local')
  }
  return {
    sessionId: tag('sessionId'),
    instance: new URL(tag('serverUrl')).origin,
    userId: tag('userId'),
    orgId: tag('organizationId')
  }
}

async function sessionFromToken({ SF_ACCESS_TOKEN, SF_INSTANCE_URL }) {
  const instance = new URL(SF_INSTANCE_URL).origin
  const res = await fetch(`${instance}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${SF_ACCESS_TOKEN}` }
  })
  if (!res.ok) throw new Error(`SF_ACCESS_TOKEN rejected: ${res.status}`)
  const info = await res.json()
  return {
    sessionId: SF_ACCESS_TOKEN,
    instance,
    userId: info.user_id,
    orgId: info.organization_id
  }
}

const CREDENTIAL_KEYS = [
  'SF_USER',
  'SF_PASS',
  'SF_TOKEN',
  'SF_LOGIN_URL',
  'SF_CLIENT_ID',
  'SF_JWT_KEY',
  'SF_JWT_KEY_FILE',
  'SF_JWT_AUDIENCE',
  'SF_ACCESS_TOKEN',
  'SF_INSTANCE_URL'
]
const MISSING_CREDENTIALS =
  'Salesforce credentials are missing: set SF_USER, SF_CLIENT_ID and SF_JWT_KEY_FILE (see docs/e2e-jwt-setup.md and .env.example)'

// The credential sets in env: the plain keys, then SF_*_2, SF_*_3, ... until
// a number has neither SF_USER_n nor SF_ACCESS_TOKEN_n. Unset CI secrets are
// empty strings, so empty values count as unset.
export function credentialSets(env) {
  const sets = []
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `_${n}`
    const set = {}
    for (const key of CREDENTIAL_KEYS) {
      if (env[`${key}${suffix}`]) set[key] = env[`${key}${suffix}`]
    }
    if (!set.SF_USER && !set.SF_ACCESS_TOKEN) break
    sets.push({ name: set.SF_USER || `org ${n}`, ...set })
  }
  return sets
}

// How a credential set logs in: 'token', 'jwt' or 'soap'.
export function loginMethod(set) {
  if (set.SF_ACCESS_TOKEN && set.SF_INSTANCE_URL) return 'token'
  return usesJwt(set) ? 'jwt' : 'soap'
}

let soapWarned = false

function loginSet(set) {
  const method = loginMethod(set)
  if (method === 'token') return sessionFromToken(set)
  if (method === 'jwt') return jwtLogin(set, { root: ROOT })
  if (!soapWarned) {
    soapWarned = true
    console.warn(
      `${set.name}: logging in with SOAP login(), which Salesforce retires in Summer '27; ` +
        'switch to the JWT bearer flow (docs/e2e-jwt-setup.md)'
    )
  }
  return soapLogin(set)
}

// Daily API requests the org still has (undefined if the call fails).
async function remainingApiRequests({ instance, sessionId }) {
  const res = await fetch(`${instance}/services/data/v${API_VERSION}/limits`, {
    headers: { Authorization: `Bearer ${sessionId}` }
  })
  if (!res.ok) return undefined
  const limits = await res.json()
  return limits.DailyApiRequests && limits.DailyApiRequests.Remaining
}

// Returns { sessionId, instance, userId, orgId } for the first credential set
// that logs in with enough daily API requests left. If every org is low, the
// one with the most requests left is used anyway.
export async function login(env = loadEnv()) {
  const sets = credentialSets(env)
  if (!sets.length) throw new Error(MISSING_CREDENTIALS)
  const minRequests = Number(env.SF_MIN_API_REQUESTS) || 500
  const failures = []
  let fallback
  for (const set of sets) {
    let session
    try {
      session = await loginSet(set)
    } catch (e) {
      failures.push(`${set.name}: ${e.message.replace(/^Salesforce login failed: /, '')}`)
      continue
    }
    const remaining = await remainingApiRequests(session)
    if (remaining === undefined || remaining >= minRequests) return session
    failures.push(`${set.name}: only ${remaining} daily API requests left`)
    if (!fallback || remaining > fallback.remaining) fallback = { session, remaining }
  }
  if (fallback) {
    console.warn(`Every Salesforce org is near its daily API limit (${failures.join('; ')}); using the best one`)
    return fallback.session
  }
  throw new Error(
    failures.length === 1
      ? `Salesforce login failed: ${failures[0].replace(/^[^:]*: /, '')}`
      : `Salesforce login failed:\n  ${failures.join('\n  ')}`
  )
}

// Sessions from a login (JWT bearer or SOAP), kept between local runs so
// back-to-back runs of the e2e flow and the UX audit don't log in each time
// (logins are rate limited, and once the org's API limit is reached even
// login fails). In .chrome-test/ (gitignored, next to the test browser's profile,
// which holds the same session as a cookie), readable only by the user. Not
// used in CI or with SF_SESSION_CACHE=0.
const SESSION_CACHE = join(ROOT, '.chrome-test', 'sf-session.json')
// Salesforce's default session timeout is 2 hours; stop reusing well before.
const SESSION_MAX_AGE_MS = 90 * 60 * 1000

function cacheKey(env) {
  return `${env.SF_USER || ''}@${(env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '')}`
}

// Like login(), but returns a session saved by an earlier run of this script
// for the same user if it's recent. fresh: always log in (and save). Callers
// should log in again with { fresh: true } when Salesforce answers 401.
export async function loginReusingSession({ fresh = false, env = loadEnv() } = {}) {
  const cache = !process.env.CI && env.SF_SESSION_CACHE !== '0' && !env.SF_ACCESS_TOKEN
  if (cache && !fresh && existsSync(SESSION_CACHE)) {
    try {
      const saved = JSON.parse(readFileSync(SESSION_CACHE, 'utf8'))
      if (saved.key === cacheKey(env) && Date.now() - saved.at < SESSION_MAX_AGE_MS) {
        return { ...saved.session, reused: true }
      }
    } catch {
      // Log in below.
    }
  }
  const session = await login(env)
  if (cache) {
    mkdirSync(dirname(SESSION_CACHE), { recursive: true })
    writeFileSync(SESSION_CACHE, JSON.stringify({ key: cacheKey(env), at: Date.now(), session }), { mode: 0o600 })
  }
  return session
}

export function frontdoorUrl({ instance, sessionId }, retURL) {
  return `${instance}/secur/frontdoor.jsp?sid=${encodeURIComponent(sessionId)}&retURL=${encodeURIComponent(retURL)}`
}

// Salesforce credentials and login shared by scripts/sf-login.mjs and e2e/.
//
// Credentials come from .env.local (or the process environment, which wins):
//   SF_USER, SF_PASS, SF_TOKEN (security token; may be empty from a trusted IP),
//   SF_LOGIN_URL (default https://login.salesforce.com; https://test.salesforce.com
//   for sandboxes).
// Alternatively SF_ACCESS_TOKEN + SF_INSTANCE_URL use an existing session
// (e.g. from `sf org display`) and skip the SOAP login.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
    throw new Error('SF_USER and SF_PASS are required (see .env.example)')
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

// Returns { sessionId, instance, userId, orgId }.
export function login(env = loadEnv()) {
  return env.SF_ACCESS_TOKEN && env.SF_INSTANCE_URL ? sessionFromToken(env) : soapLogin(env)
}

// Sessions from SOAP login, kept between local runs so back-to-back runs of
// the e2e flow, the UX audit and sf-login.mjs don't log in each time (each
// login is a SOAP call, and once the org's API limit is reached even login
// fails). In .chrome-test/ (gitignored, next to the test browser's profile,
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

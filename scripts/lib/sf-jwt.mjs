// OAuth 2.0 JWT bearer flow for the e2e flow and the dev scripts: an
// assertion signed (RS256) with the private key whose certificate is uploaded
// to the org's External Client App (or connected app), exchanged at
// <login URL>/services/oauth2/token for an access token. No password, no
// security token, no SOAP (Salesforce retires SOAP login() in Summer '27).
// Setup: docs/e2e-jwt-setup.md.
//
// Credentials (see scripts/lib/sf-auth.mjs for the numbered fallback orgs):
//   SF_USER          the username the token is for (the assertion's sub)
//   SF_CLIENT_ID     the app's consumer key (iss)
//   SF_JWT_KEY_FILE  path to the PEM private key (relative to the repository
//                    root), or SF_JWT_KEY: the PEM itself (newlines may be
//                    written as \n) or the PEM base64-encoded
//   SF_LOGIN_URL     where to ask for the token (default
//                    https://login.salesforce.com; a My Domain URL works too)
//   SF_JWT_AUDIENCE  optional aud; by default https://test.salesforce.com for
//                    sandboxes and https://login.salesforce.com otherwise

import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

export const JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
// Salesforce accepts assertions that expire within 3 minutes.
export const JWT_LIFETIME_SECONDS = 120

export const base64url = data => Buffer.from(data).toString('base64url')

export const loginUrlOf = set => (set.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '')

// True when the set has what the JWT bearer flow needs (a client id and a key).
export const usesJwt = set => Boolean(set.SF_CLIENT_ID || set.SF_JWT_KEY || set.SF_JWT_KEY_FILE)

// The assertion's aud: Salesforce wants the login server, not the My Domain.
export function jwtAudience(loginUrl, override) {
  if (override) return override.replace(/\/$/, '')
  const host = new URL(loginUrl).hostname
  return host === 'test.salesforce.com' || host.endsWith('.sandbox.my.salesforce.com')
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com'
}

// The private key as a KeyObject, from SF_JWT_KEY or SF_JWT_KEY_FILE.
export function readJwtKey({ SF_JWT_KEY, SF_JWT_KEY_FILE }, root = process.cwd()) {
  let pem
  if (SF_JWT_KEY) {
    pem = SF_JWT_KEY.includes('-----BEGIN')
      ? SF_JWT_KEY.replace(/\\n/g, '\n')
      : Buffer.from(SF_JWT_KEY, 'base64').toString('utf8')
  } else if (SF_JWT_KEY_FILE) {
    const file = isAbsolute(SF_JWT_KEY_FILE) ? SF_JWT_KEY_FILE : join(root, SF_JWT_KEY_FILE)
    try {
      pem = readFileSync(file, 'utf8')
    } catch (e) {
      throw new Error(`Can't read SF_JWT_KEY_FILE ${SF_JWT_KEY_FILE}: ${e.code || e.message}`)
    }
  } else {
    throw new Error('SF_JWT_KEY or SF_JWT_KEY_FILE is required with SF_CLIENT_ID (see docs/e2e-jwt-setup.md)')
  }
  try {
    return createPrivateKey(pem)
  } catch (e) {
    throw new Error(`The JWT private key isn't a PEM private key: ${e.message}`)
  }
}

// header.claims.signature, RS256.
export function buildJwtAssertion({
  clientId,
  username,
  audience,
  privateKey,
  now = Date.now(),
  lifetimeSeconds = JWT_LIFETIME_SECONDS
}) {
  if (!clientId) throw new Error('SF_CLIENT_ID is required for the JWT bearer flow')
  if (!username) throw new Error('SF_USER is required for the JWT bearer flow')
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: clientId,
      sub: username,
      aud: audience,
      exp: Math.floor(now / 1000) + lifetimeSeconds
    })
  )
  const input = `${header}.${claims}`
  return `${input}.${base64url(sign('sha256', Buffer.from(input), privateKey))}`
}

// Hints for the token endpoint's usual refusals.
function hint(description = '') {
  if (/approved/i.test(description)) {
    return " (pre-authorize the user: the app's policies must say admin-approved users are pre-authorized, and the user needs the app's profile or permission set)"
  }
  if (/client identifier|client_id/i.test(description)) return ' (check SF_CLIENT_ID: the consumer key)'
  if (/audience/i.test(description)) return ' (check SF_LOGIN_URL or SF_JWT_AUDIENCE)'
  if (/assertion|signature|JWT|expired/i.test(description))
    return " (the key doesn't match the app's certificate, or the clock is off)"
  return ''
}

// The id URL https://login.salesforce.com/id/<orgId>/<userId> -> ids.
export function idsFromIdentityUrl(id = '') {
  const m = /\/id\/([^/]+)\/([^/?]+)/.exec(id)
  return m ? { orgId: m[1], userId: m[2] } : {}
}

// Resolves { sessionId, instance, userId, orgId } like SOAP login().
export async function jwtLogin(set, { root } = {}) {
  const loginUrl = loginUrlOf(set)
  const assertion = buildJwtAssertion({
    clientId: set.SF_CLIENT_ID,
    username: set.SF_USER,
    audience: jwtAudience(loginUrl, set.SF_JWT_AUDIENCE),
    privateKey: readJwtKey(set, root)
  })
  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: JWT_GRANT_TYPE, assertion }).toString()
  })
  const text = await res.text()
  let body = {}
  try {
    body = JSON.parse(text)
  } catch {
    // Not JSON: reported below.
  }
  if (!res.ok || !body.access_token) {
    const description = body.error_description || body.error || `${res.status} ${text.slice(0, 200)}`
    throw new Error(`Salesforce login failed: ${description}${hint(description)}`)
  }
  return {
    sessionId: body.access_token,
    instance: new URL(body.instance_url).origin,
    ...idsFromIdentityUrl(body.id)
  }
}

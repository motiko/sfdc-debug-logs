// The JWT bearer login (scripts/lib/sf-auth.mjs login()) against the mock
// org's token endpoint, in-process (no browser): part of npm run test:harness.

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { MockOrg } from './org.mjs'
import { login } from '../../scripts/lib/sf-auth.mjs'
import { JWT_GRANT_TYPE, buildJwtAssertion } from '../../scripts/lib/sf-jwt.mjs'

let org, env, original
beforeEach(() => {
  org = new MockOrg()
  env = org.createJwtApp()
  original = globalThis.fetch
  globalThis.fetch = (input, init) => org.fetch(input, init)
})
afterEach(() => {
  globalThis.fetch = original
})

test('login() gets a session with the JWT bearer flow, no SOAP', async () => {
  const session = await login(env)
  assert.deepEqual(session, {
    sessionId: org.sessionId,
    instance: env.SF_LOGIN_URL,
    userId: org.user.Id,
    orgId: org.orgId
  })
  const { byKind, apiRequests } = org.stats()
  assert.equal(byKind['oauth token'], 1)
  assert.equal(byKind['soap login'], undefined)
  // The limits check is the only API request; the token request isn't one.
  assert.equal(apiRequests, 1)
})

test('the token endpoint refuses what Salesforce refuses, and login() says why', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })
  await assert.rejects(login({ ...env, SF_JWT_KEY: other }), /invalid assertion.*certificate/)
  await assert.rejects(login({ ...env, SF_CLIENT_ID: 'unknown' }), /client identifier invalid.*SF_CLIENT_ID/)
  await assert.rejects(login({ ...env, SF_USER: 'someone@example.com' }), /approved this consumer.*pre-authorize/)
  await assert.rejects(login({ ...env, SF_JWT_AUDIENCE: 'https://example.com' }), /audience/)
})

test('an expired assertion is refused', async () => {
  const assertion = buildJwtAssertion({
    clientId: env.SF_CLIENT_ID,
    username: env.SF_USER,
    audience: 'https://login.salesforce.com',
    privateKey: env.SF_JWT_KEY,
    now: Date.now() - 600_000
  })
  const res = await fetch(`${env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_GRANT_TYPE, assertion }).toString()
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'invalid_grant')
})

// node --test scripts/lib/*.test.mjs (also part of npm run test:harness in e2e/)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildJwtAssertion,
  idsFromIdentityUrl,
  jwtAudience,
  readJwtKey,
  usesJwt,
  JWT_LIFETIME_SECONDS
} from './sf-jwt.mjs'
import { credentialSets, loginMethod } from './sf-auth.mjs'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })

const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))

test('the assertion is an RS256 JWT with the claims Salesforce checks', () => {
  const now = Date.UTC(2026, 9, 12, 10, 0, 0)
  const jwt = buildJwtAssertion({
    clientId: '3MVG9abc',
    username: 'dev@example.com',
    audience: 'https://login.salesforce.com',
    privateKey,
    now
  })
  const parts = jwt.split('.')
  assert.equal(parts.length, 3)
  for (const part of parts) assert.match(part, /^[A-Za-z0-9_-]+$/, 'base64url without padding')
  assert.deepEqual(decode(parts[0]), { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(decode(parts[1]), {
    iss: '3MVG9abc',
    sub: 'dev@example.com',
    aud: 'https://login.salesforce.com',
    exp: now / 1000 + JWT_LIFETIME_SECONDS
  })
  assert.ok(JWT_LIFETIME_SECONDS <= 180, 'Salesforce accepts at most 3 minutes')
  const signed = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'))
  assert.ok(signed, 'signature verifies with the public key')
})

test('the assertion needs a client id and a user', () => {
  const base = { audience: 'https://login.salesforce.com', privateKey }
  assert.throws(() => buildJwtAssertion({ ...base, username: 'u' }), /SF_CLIENT_ID/)
  assert.throws(() => buildJwtAssertion({ ...base, clientId: 'c' }), /SF_USER/)
})

test('the audience is the login server, test.salesforce.com for sandboxes', () => {
  assert.equal(jwtAudience('https://login.salesforce.com'), 'https://login.salesforce.com')
  assert.equal(jwtAudience('https://acme.my.salesforce.com'), 'https://login.salesforce.com')
  assert.equal(jwtAudience('https://test.salesforce.com'), 'https://test.salesforce.com')
  assert.equal(jwtAudience('https://acme--dev.sandbox.my.salesforce.com'), 'https://test.salesforce.com')
  assert.equal(jwtAudience('https://acme.my.salesforce.com', 'https://custom.example/'), 'https://custom.example')
})

test('the key comes from SF_JWT_KEY (PEM, escaped newlines, base64) or SF_JWT_KEY_FILE', () => {
  const same = key => assert.equal(key.export({ type: 'pkcs8', format: 'pem' }), pem)
  same(readJwtKey({ SF_JWT_KEY: pem }))
  same(readJwtKey({ SF_JWT_KEY: pem.replace(/\n/g, '\\n') }))
  same(readJwtKey({ SF_JWT_KEY: Buffer.from(pem).toString('base64') }))
  const dir = mkdtempSync(join(tmpdir(), 'sf-jwt-'))
  writeFileSync(join(dir, 'server.key'), pem)
  same(readJwtKey({ SF_JWT_KEY_FILE: join(dir, 'server.key') }))
  same(readJwtKey({ SF_JWT_KEY_FILE: 'server.key' }, dir))
  assert.throws(() => readJwtKey({ SF_JWT_KEY_FILE: 'missing.key' }, dir), /Can't read SF_JWT_KEY_FILE missing\.key/)
  assert.throws(() => readJwtKey({ SF_JWT_KEY: '-----BEGIN PRIVATE KEY-----\\nnope' }), /isn't a PEM private key/)
  assert.throws(() => readJwtKey({}), /SF_JWT_KEY or SF_JWT_KEY_FILE/)
})

test('user and org ids come from the identity URL', () => {
  assert.deepEqual(idsFromIdentityUrl('https://login.salesforce.com/id/00D000000000001AAA/005000000000001AAA'), {
    orgId: '00D000000000001AAA',
    userId: '005000000000001AAA'
  })
  assert.deepEqual(idsFromIdentityUrl(undefined), {})
})

test('each org logs in with a token, JWT or SOAP, and JWT keys are numbered too', () => {
  const sets = credentialSets({
    SF_USER: 'one@example.com',
    SF_CLIENT_ID: 'c1',
    SF_JWT_KEY_FILE: 'one.key',
    SF_USER_2: 'two@example.com',
    SF_PASS_2: 'p',
    SF_TOKEN_2: 't',
    // Unset CI secrets are empty strings.
    SF_CLIENT_ID_2: '',
    SF_ACCESS_TOKEN_3: 'tok',
    SF_INSTANCE_URL_3: 'https://acme.my.salesforce.com'
  })
  assert.deepEqual(
    sets.map(s => [s.name, loginMethod(s)]),
    [
      ['one@example.com', 'jwt'],
      ['two@example.com', 'soap'],
      ['org 3', 'token']
    ]
  )
  assert.equal(sets[0].SF_JWT_KEY_FILE, 'one.key')
  assert.equal(usesJwt({ SF_USER: 'u', SF_PASS: 'p' }), false)
  // A half-configured JWT set fails (reported) instead of quietly using SOAP.
  assert.equal(loginMethod({ SF_USER: 'u', SF_PASS: 'p', SF_CLIENT_ID: 'c' }), 'jwt')
})

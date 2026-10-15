// Checks the offline harness itself (npm run test:harness): the mock org's
// API and Apex runner, the request counts, and the Lightning wait's retry,
// with a redirect slower than the wait (the e2e flow's flaky case).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { runAnonymousApex } from './apex.mjs'
import { MockOrg } from './org.mjs'
import { frontdoorUrl } from '../../scripts/lib/sf-auth.mjs'
import { startRun } from '../lib/run.mjs'
import { gotoLightning } from '../lib/lightning.mjs'

test('the Apex runner writes a log with every category the views style', () => {
  const user = { Id: '005MK0000000001AAA', Name: 'Dev', Username: 'dev@example.com' }
  const { log, success } = runAnonymousApex(
    `String m = 'X';
List<User> u = [SELECT Id, Name FROM User LIMIT 1];
System.debug(m + ' ' + u);
for (Integer i = 0; i < 3; i++) { System.debug('n ' + i); }
try { Integer x = 1 / 0; } catch (Exception e) { System.debug(LoggingLevel.ERROR, e.getMessage()); }`,
    { user, data: { User: [user] } }
  )
  assert.equal(success, true)
  for (const event of [
    'USER_DEBUG|[3]|DEBUG|X (User:{Id=005MK0000000001AAA, Name=Dev})',
    'USER_DEBUG|[4]|DEBUG|n 2',
    'SOQL_EXECUTE_BEGIN',
    'METHOD_ENTRY',
    'SYSTEM_METHOD_ENTRY',
    'EXCEPTION_THROWN|[5]|System.MathException: Divide by 0',
    'USER_DEBUG|[5]|ERROR|Divide by 0'
  ]) {
    assert.ok(log.includes(event), event)
  }
  const failed = runAnonymousApex('Integer y = 1 / 0;', { user, data: {} })
  assert.equal(failed.success, false)
  assert.ok(failed.log.includes('FATAL_ERROR|System.MathException: Divide by 0'))
})

test('the mock API needs the session and counts every request', async () => {
  const org = new MockOrg()
  const denied = await org.handle({ url: '/services/data/v62.0/sobjects' })
  assert.equal(denied.status, 401)
  const auth = { authorization: `Bearer ${org.sessionId}` }
  const q = encodeURIComponent(`SELECT COUNT() FROM ApexLog WHERE LogUserId = '${org.user.Id}'`)
  const count = await org.handle({ url: `/services/data/v62.0/tooling/query?q=${q}`, headers: auth })
  assert.equal(JSON.parse(count.body).totalSize, 2)
  assert.deepEqual(org.stats().byKind, { 'describe global': 1, 'tooling query': 1 })
})

test('the mock org finds users, classes and triggers by name, and limits trace flags to 24 hours', async () => {
  const org = new MockOrg()
  const auth = { authorization: `Bearer ${org.sessionId}`, 'content-type': 'application/json' }
  const query = async (path, soql) =>
    JSON.parse(
      (await org.handle({ url: `/services/data/v62.0${path}?q=${encodeURIComponent(soql)}`, headers: auth })).body
    ).records
  const users = await query(
    '/query',
    "SELECT Id, Name FROM User WHERE IsActive = true AND (Name LIKE '%other%' OR Username LIKE '%other%') ORDER BY Name LIMIT 20"
  )
  assert.deepEqual(
    users.map(u => u.Name),
    ['Other Developer']
  )
  const [automated] = await query('/query', "SELECT Id FROM User WHERE UserType = 'AutomatedProcess' LIMIT 1")
  assert.equal(automated.Id, org.automatedProcess.Id)
  // An escaped wildcard matches itself only.
  const none = await query('/tooling/query', "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Lead\\_%' ORDER BY Name")
  assert.deepEqual(none, [])
  const handlers = await query(
    '/tooling/query',
    "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%lead%' ORDER BY Name"
  )
  assert.deepEqual(
    handlers.map(c => c.Name),
    ['LeadTriggerHandler']
  )
  const start = Date.now()
  const post = await org.handle({
    method: 'POST',
    url: '/services/data/v62.0/tooling/sobjects/TraceFlag',
    headers: auth,
    body: JSON.stringify({
      TracedEntityId: handlers[0].Id,
      LogType: 'CLASS_TRACING',
      StartDate: new Date(start).toISOString(),
      ExpirationDate: new Date(start + 3600_000).toISOString()
    })
  })
  const { id } = JSON.parse(post.body)
  const tooLong = await org.handle({
    method: 'PATCH',
    url: `/services/data/v62.0/tooling/sobjects/TraceFlag/${id}`,
    headers: auth,
    body: JSON.stringify({ ExpirationDate: new Date(start + 25 * 3600_000).toISOString() })
  })
  assert.equal(tooLong.status, 400)
})

let run, ext
before(async () => {
  run = await startRun({ mock: true })
  ext = await run.launch()
})
after(() => run && run.close())

test('Chrome reaches only the mock org', async () => {
  const page = await ext.browser.newPage()
  const failed = await page.goto('https://login.salesforce.com/').then(
    () => false,
    () => true
  )
  assert.ok(failed, 'a real Salesforce host must not resolve')
  await page.close()
})

test('gotoLightning navigates again when the redirect to Lightning is too slow', async () => {
  // The first redirect to Lightning hangs longer than the wait; the second
  // is immediate.
  run.mock.org.delays.push({ pattern: /lightning\.force\.com\/secur\/contentDoor/, ms: 8000, times: 1 })
  const page = await ext.browser.newPage()
  const lines = []
  const result = await gotoLightning(page, frontdoorUrl(run.session, '/lightning/page/home'), '.lightning.force.com', {
    landTimeout: 3000,
    log: line => lines.push(line)
  })
  assert.equal(result.attempt, 2, lines.join('\n'))
  assert.equal(result.shell, true, 'the Lightning shell is found')
  await page.close()
})

test('gotoLightning fails clearly when Lightning never comes', async () => {
  run.mock.org.delays.push({ pattern: /lightning\.force\.com\/secur\/contentDoor/, ms: 8000, times: 2 })
  const page = await ext.browser.newPage()
  await assert.rejects(
    gotoLightning(page, frontdoorUrl(run.session, '/lightning/page/home'), '.lightning.force.com', {
      landTimeout: 2000
    }),
    /did not reach \*\.lightning\.force\.com after 2 attempts/
  )
  await page.close()
})

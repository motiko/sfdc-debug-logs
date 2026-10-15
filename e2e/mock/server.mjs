// Serves the mock org (mock/org.mjs) over HTTPS on 127.0.0.1, for Chrome
// started with launchWithExtension({ mock }) (e2e/lib/browser.mjs), which maps
// the mock org's hosts (*.my.salesforce.com, *.lightning.force.com,
// *.my.salesforce-setup.com under "apexdbgr-mock") to this server and every
// other host to nowhere: an offline run can't reach a real org, and no real
// session exists in it.
//
//   const mock = await startMockOrg()
//   mock.session        { sessionId, instance, userId, orgId } like login()
//   mock.jwtEnv         credentials for login() with the JWT bearer flow
//                       against the mock org (its External Client App)
//   mock.org            the MockOrg (data, stats(), delays)
//   mock.resolverRules  for Chrome's --host-resolver-rules
//   await mock.close()

import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockOrg, MOCK_DOMAIN, MOCK_HOSTS } from './org.mjs'
import { classListPage, lightningPage, logDetailPage, logListPage, recordPage } from './pages.mjs'

// A self-signed certificate (Chrome runs with --ignore-certificate-errors for
// mock runs), made once with openssl.
function certificate() {
  const dir = join(tmpdir(), 'apexdbgr-mock-cert')
  const key = join(dir, 'key.pem')
  const cert = join(dir, 'cert.pem')
  if (!existsSync(key) || !existsSync(cert)) {
    mkdirSync(dir, { recursive: true })
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '30',
        '-subj',
        `/CN=${MOCK_DOMAIN}`
      ],
      { stdio: 'ignore' }
    )
  }
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

const delay = ms => new Promise(r => setTimeout(r, ms))

function cookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(c => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
  )
}

export async function startMockOrg({ org = new MockOrg() } = {}) {
  const classes = [
    { Id: '01pMK0000000001AAA', Name: 'AccountService', size: 1520 },
    { Id: '01pMK0000000002AAA', Name: 'InvoiceBatch', size: 3044 },
    { Id: '01pMK0000000003AAA', Name: 'LeadTriggerHandler', size: 812 }
  ]
  const sessionCookies = (host, sid) => [
    `sid=${encodeURIComponent(sid)}; Path=/; Secure; HttpOnly; SameSite=None`,
    `disco=5:${org.orgId}:${org.user.Id}:0:${host}; Path=/; Secure; SameSite=None`
  ]

  async function route(req, body) {
    const host = (req.headers.host || '').split(':')[0]
    const url = new URL(req.url, `https://${host}`)
    const path = url.pathname
    // The delays that apply now (one taken from each), decided before
    // waiting: a held request must not use up delays added meanwhile.
    const held = org.delays.filter(d => (d.times ?? 1) > 0 && d.pattern.test(`${host}${path}`))
    for (const d of held) if (d.times !== undefined) d.times--
    for (const d of held) await delay(d.ms)
    if (path.startsWith('/services/')) {
      const api = await org.handle({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
        source: 'browser'
      })
      return api || { status: 404, headers: {}, body: 'not found' }
    }
    const signedIn = cookies(req.headers.cookie).sid
    const html = content => ({ status: 200, headers: { 'content-type': 'text/html;charset=UTF-8' }, body: content })
    const redirect = (location, setCookies = []) => ({
      status: 302,
      headers: { location, ...(setCookies.length ? { 'set-cookie': setCookies } : {}) },
      body: ''
    })
    if (path === '/secur/frontdoor.jsp') {
      if (url.searchParams.get('sid') !== org.sessionId) return html('<h1>Invalid session</h1>')
      return redirect(url.searchParams.get('retURL') || '/', sessionCookies(host, org.sessionId))
    }
    // Lightning pages live on their own domains, with their own session
    // cookie (which the API doesn't accept, like Salesforce's).
    if (host === MOCK_HOSTS.api && path.startsWith('/lightning/')) {
      const target = path.startsWith('/lightning/setup/') ? MOCK_HOSTS.setup : MOCK_HOSTS.lightning
      return redirect(`https://${target}/secur/contentDoor?startURL=${encodeURIComponent(path + url.search)}`)
    }
    if (path === '/secur/contentDoor') {
      return redirect(url.searchParams.get('startURL') || '/', sessionCookies(host, `${org.sessionId}-ui`))
    }
    if (host !== MOCK_HOSTS.api && !path.startsWith('/lightning/')) {
      // Classic URLs on the Lightning domains go to the classic domain.
      return redirect(`https://${MOCK_HOSTS.api}${path}${url.search}`)
    }
    if (!signedIn) return html('<h1>Login</h1><p>Mock org: open /secur/frontdoor.jsp first.</p>')
    if (path.startsWith('/lightning/setup/')) return html(lightningPage('Setup: Debug Logs'))
    if (path.startsWith('/lightning/')) return html(lightningPage('Home'))
    if (path.startsWith('/p/setup/layout/ApexDebugLogDetailEdit/')) {
      const id = url.searchParams.get('apex_log_id')
      const log = org.logs.find(l => l.Id === id)
      if (!log) return html('<h1>Data Not Available</h1>')
      return html(logDetailPage(log, org.bodies.get(id)))
    }
    if (path === '/setup/ui/listApexTraces.apexp') {
      const logs = [...org.logs].sort((a, b) => (a.StartTime < b.StartTime ? 1 : -1)).slice(0, 50)
      return html(logListPage(logs, org.traceFlags, org.user))
    }
    if (path.startsWith('/01p') || path === '/setup/build/allTriggers.apexp') return html(classListPage(classes))
    if (path === '/servlet/servlet.FileDownload') {
      return {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: org.bodies.get(url.searchParams.get('file')) || ''
      }
    }
    if (path === '/favicon.ico' || path.startsWith('/img/')) return { status: 404, headers: {}, body: '' }
    return html(recordPage(path === '/' ? 'Home' : `Record ${path.slice(1)}`))
  }

  const server = createServer(certificate(), (req, res) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      try {
        const response = await route(req, Buffer.concat(chunks).toString('utf8'))
        // Extension pages call the API cross-origin (host permissions allow it).
        res.writeHead(response.status, { 'cache-control': 'no-store', ...response.headers })
        res.end(response.body)
      } catch (e) {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end(`mock org error: ${e.stack}`)
      }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    org,
    port,
    hosts: MOCK_HOSTS,
    jwtEnv: org.createJwtApp(),
    session: {
      sessionId: org.sessionId,
      instance: `https://${MOCK_HOSTS.api}`,
      userId: org.user.Id,
      orgId: org.orgId
    },
    // Chrome: the mock hosts go to this server, every other host fails.
    resolverRules: `MAP ${MOCK_DOMAIN}.* 127.0.0.1:${port}, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`,
    close: () =>
      new Promise(resolve => {
        server.close(resolve)
        server.closeAllConnections()
      })
  }
}

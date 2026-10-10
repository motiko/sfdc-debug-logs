// Log the dev Chrome (scripts/chrome-dev.sh) into Salesforce using the
// credentials in .env.local, via SOAP login + frontdoor.jsp.
//
// .env.local keys: SF_USER, SF_PASS, SF_TOKEN (security token, may be empty
// when logging in from a trusted IP), optional SF_LOGIN_URL
// (default https://login.salesforce.com; use https://test.salesforce.com for
// sandboxes).
//
// Usage: node scripts/sf-login.mjs [retURL]   (CDP_PORT defaults to 9222)

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = join(ROOT, '.env.local')
const PORT = process.env.CDP_PORT || 9222
const RET_URL = process.argv[2] || '/setup/ui/listApexTraces.apexp'
const API_VERSION = '59.0'

function loadEnv(file) {
  if (!existsSync(file)) {
    throw new Error(`${file} not found; copy .env.example and fill it in`)
  }
  const env = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const xmlEscape = s =>
  s.replace(/[<>&'"]/g, c => `&#${c.charCodeAt(0)};`)

async function soapLogin({ SF_USER, SF_PASS, SF_TOKEN = '', SF_LOGIN_URL }) {
  if (!SF_USER || !SF_PASS) throw new Error('SF_USER and SF_PASS are required')
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
  return { sessionId: tag('sessionId'), instance: new URL(tag('serverUrl')).origin }
}

async function cdpPageSocket() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json()
      const page = targets.find(t => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`No Chrome page on CDP port ${PORT}; is scripts/chrome-dev.sh running?`)
}

async function navigate(wsUrl, url) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  await new Promise(resolve => {
    ws.onmessage = e => JSON.parse(e.data).id === 1 && resolve()
    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url } }))
  })
  ws.close()
}

try {
  const { sessionId, instance } = await soapLogin(loadEnv(ENV_FILE))
  const frontdoor = `${instance}/secur/frontdoor.jsp?sid=${encodeURIComponent(sessionId)}&retURL=${encodeURIComponent(RET_URL)}`
  await navigate(await cdpPageSocket(), frontdoor)
  console.log(`Logged in to ${instance}`)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

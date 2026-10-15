// Log the dev Chrome (scripts/chrome-dev.sh) into Salesforce using the
// credentials in .env.local (JWT bearer flow, see scripts/lib/sf-auth.mjs and
// docs/e2e-jwt-setup.md), via frontdoor.jsp.
// The session id is sent over CDP so it never appears on a command line.
//
// Usage: node scripts/sf-login.mjs [retURL]   (CDP_PORT defaults to 9222)

import { login, frontdoorUrl } from './lib/sf-auth.mjs'

const PORT = process.env.CDP_PORT || 9222
const RET_URL = process.argv[2] || '/setup/ui/listApexTraces.apexp'

async function cdpPageSocket() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://localhost:${PORT}/json/list`)).json()
      const page = targets.find(t => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch (e) {
      // Chrome is not listening yet; retry.
    }
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
  const session = await login()
  await navigate(await cdpPageSocket(), frontdoorUrl(session, RET_URL))
  console.log(`Logged in to ${session.instance}`)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

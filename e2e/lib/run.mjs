// What a run of the e2e flow or the UX audit needs: a Salesforce session, the
// e2e Salesforce helper, Chrome with the extension, and the request counter.
//
// Against the real org (default): logs in with .env.local, reusing a recent
// session (scripts/lib/sf-auth.mjs loginReusingSession).
// Offline (mock: true, or SF_MOCK=1): starts the mock org (e2e/mock/), and
// Chrome reaches only that; nothing goes to Salesforce.
//
//   const run = await startRun()
//   run.session, run.sf, run.mock (null for the real org)
//   const ext = await run.launch()
//   ... run.report() prints the request counts; await run.close()

import { loginReusingSession } from '../../scripts/lib/sf-auth.mjs'
import { Salesforce } from './salesforce.mjs'
import { launchWithExtension } from './browser.mjs'
import { createRequestCounter, formatSummary } from './request-counter.mjs'
import { startMockOrg } from '../mock/server.mjs'
import { MOCK_DOMAIN } from '../mock/org.mjs'

export const MOCK = process.env.SF_MOCK === '1'

export async function startRun({ mock = MOCK } = {}) {
  const counter = createRequestCounter()
  let mockOrg = null
  let restoreFetch = () => {}
  let session
  if (mock) {
    mockOrg = await startMockOrg()
    // Node's requests to the mock hosts go to the mock org, in-process.
    const original = globalThis.fetch
    globalThis.fetch = (input, init) => {
      const url = String(input instanceof Request ? input.url : input)
      if (new URL(url).hostname.startsWith(`${MOCK_DOMAIN}.`)) return mockOrg.org.fetch(url, init)
      return original(input, init)
    }
    const unwrap = counter.wrapFetch()
    restoreFetch = () => {
      unwrap()
      globalThis.fetch = original
    }
    session = mockOrg.session
  } else {
    restoreFetch = counter.wrapFetch()
    session = await loginReusingSession()
  }
  const sf = new Salesforce(session, {
    // A reused session can have expired: log in again, once.
    relogin: mock ? null : () => loginReusingSession({ fresh: true })
  })
  let ext = null
  return {
    mock: mockOrg,
    // After a relogin, the new session.
    get session() {
      return sf.session
    },
    sf,
    counter,
    async launch() {
      ext = await launchWithExtension({ mock: mockOrg })
      await counter.trackBrowser(ext.browser)
      return ext
    },
    // Prints the counts (and, offline, the mock org's own, which also sees
    // requests puppeteer's page events miss). Returns them.
    report(title = 'Salesforce requests') {
      const counted = counter.summary()
      const lines = formatSummary(`${title} (counted)`, counted)
      let server = null
      if (mockOrg) {
        server = mockOrg.org.stats()
        lines.push(...formatSummary(`${title} (mock org)`, server))
      }
      console.log(['', ...lines].join('\n'))
      return { counted, server }
    },
    async close() {
      if (ext) await ext.close()
      restoreFetch()
      if (mockOrg) await mockOrg.close()
    }
  }
}

// Counts the Salesforce API requests a run makes, so the e2e flow and the UX
// audit can print what they cost the org's daily API limit:
//   - Node: every fetch to a Salesforce host (login, the e2e helpers), by
//     wrapping globalThis.fetch;
//   - the browser: every request a page makes to a Salesforce API path (the
//     app, content scripts), from puppeteer's request events of every page,
//     including tabs the extension opens.
// The service worker only reads cookies, so it makes none. Kinds are those of
// e2e/mock/org.mjs (requestKind); "API requests" are the ones Salesforce
// counts against the limit (not logins or userinfo).

import { COUNTS_AGAINST_LIMIT, requestKind } from '../mock/org.mjs'

const SALESFORCE_HOST = /(\.salesforce\.com|\.force\.com|\.salesforce-setup\.com)$/

export function createRequestCounter() {
  const requests = []
  const pages = new WeakSet()

  function record(source, method, url) {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return
    }
    if (!SALESFORCE_HOST.test(parsed.hostname)) return
    const kind = requestKind(method, parsed.pathname)
    if (kind) requests.push({ source, kind, method, path: parsed.pathname })
  }

  function trackPage(page) {
    if (!page || pages.has(page)) return
    pages.add(page)
    page.on('request', request => record('browser', request.method(), request.url()))
  }

  return {
    record,

    // Wraps globalThis.fetch (Node) so every Salesforce request is counted.
    // Returns a function that restores the original.
    wrapFetch() {
      const original = globalThis.fetch
      globalThis.fetch = (input, init = {}) => {
        record('node', init.method || 'GET', String(input instanceof Request ? input.url : input))
        return original(input, init)
      }
      return () => (globalThis.fetch = original)
    },

    // Counts the requests of every page of `browser`, now and later.
    async trackBrowser(browser) {
      for (const page of await browser.pages()) trackPage(page)
      browser.on('targetcreated', async target => {
        if (target.type() === 'page') trackPage(await target.page().catch(() => null))
      })
    },

    summary() {
      const bySource = {}
      const byKind = {}
      let apiRequests = 0
      for (const r of requests) {
        bySource[r.source] = (bySource[r.source] || 0) + 1
        byKind[r.kind] = (byKind[r.kind] || 0) + 1
        if (COUNTS_AGAINST_LIMIT(r.kind)) apiRequests++
      }
      return { total: requests.length, apiRequests, bySource, byKind }
    }
  }
}

// A summary as printable lines.
export function formatSummary(title, { total, apiRequests, bySource, byKind }) {
  const sorted = Object.entries(byKind).sort((a, b) => b[1] - a[1])
  return [
    `${title}: ${apiRequests} API requests (${total} Salesforce requests in all)`,
    `  by source: ${Object.entries(bySource)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    ...sorted.map(([kind, n]) => `  ${String(n).padStart(5)}  ${kind}`)
  ]
}

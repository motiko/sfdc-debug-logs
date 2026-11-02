// Which Salesforce hosts may get an API session, and where that session lives.
// Used by the service worker (extension/background.ts).

// Lightning and Setup pages run on domains whose sid cookie isn't accepted by
// the API; the org's my.salesforce.com domain has the API session.
export function apiHostFor(host: string): string {
  return host
    .replace(/\.lightning\.force\.com$/, '.my.salesforce.com')
    .replace(/\.my\.salesforce-setup\.com$/, '.my.salesforce.com')
}

// Org (My Domain, Lightning, Setup and classic instance) hosts. The content
// scripts also run on *.force.com, which includes public Salesforce Sites that
// anyone can host, so sessions are only handed out for org hosts.
export function isOrgHost(host: string): boolean {
  return (
    /\.(my\.salesforce\.com|lightning\.force\.com|my\.salesforce-setup\.com)$/.test(
      host
    ) || /^[a-z]{2,4}\d+\.salesforce\.com$/.test(host)
  )
}

export interface SessionCookie {
  domain: string
  value: string
}

// Picks the API session among the org's sid cookies: the cookie of the API
// host (apiHostFor), or else a My Domain cookie whose session belongs to
// the same org (a session id starts with the org id's 15 characters), for
// orgs whose API host can't be derived from the page's host. Lightning and
// Setup cookies are never returned: the API rejects them.
export function pickSessionCookie(
  cookies: SessionCookie[],
  { apiHost, orgId }: { apiHost: string; orgId?: string }
): { token: string; host: string } | undefined {
  const exact = cookies.find(c => c.domain === apiHost && c.value)
  if (exact) return { token: exact.value, host: exact.domain }
  const prefix = orgId && orgId.slice(0, 15)
  if (!prefix) return undefined
  const same = cookies.find(
    c => /\.my\.salesforce\.com$/.test(c.domain) && c.value.startsWith(prefix)
  )
  return same ? { token: same.value, host: same.domain } : undefined
}

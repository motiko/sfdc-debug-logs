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

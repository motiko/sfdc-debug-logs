// The log viewer's tab for an org: its URL (html/app.html with the org and
// user ids, the session and the API host) and the name the service worker
// tracks it by. Used by the content scripts (Shift+W, page-session.ts) and by
// the service worker (the toolbar button, background.ts). No imports.

export interface OrgIds {
  orgId: string | undefined
  userId: string | undefined
}

export interface AppSession {
  token: string | undefined
  host: string
}

// The name the service worker keeps the org's app tab id under.
export const appTabName = (orgId: string | undefined) => `app_${orgId}`

// html/app.html?oid=&uid=&sid=&host= (appPage: chrome.runtime.getURL of
// html/app.html). Missing ids are passed as "undefined": the app then asks
// Salesforce (global-sf.ts).
export function appPageUrl(
  appPage: string,
  { orgId, userId }: OrgIds,
  { token, host }: AppSession
): string {
  return `${appPage}?oid=${orgId}&uid=${userId}&sid=${encodeURIComponent(
    token
  )}&host=${encodeURIComponent(host)}`
}

// Salesforce's disco cookie: "<n>:<orgId>:<userId>:…".
export function parseDisco(value: string | null | undefined): OrgIds {
  if (!value) return { orgId: undefined, userId: undefined }
  const ids = value.split(':')
  return { orgId: ids[1] || undefined, userId: ids[2] || undefined }
}

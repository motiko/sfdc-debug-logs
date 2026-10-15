// Session, org and user of the Salesforce page a content script runs on, and
// the Salesforce client that calls the API with that session.
import { createSalesforceClient } from './salesforce/client'
import { createRequest } from './salesforce/request'
import { requireExtensionContext } from './extension-context'

export interface Session {
  token: string | undefined
  host: string
}

// Returns a cookie's value, or null. Matches the last cookie too, which has
// no trailing ';'.
export function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')
  )
  return match ? match[1] : null
}

// Returns { token, host }: the API session id and the host it belongs to.
// Salesforce's sid cookie is HttpOnly, so it usually can't be read here; the
// service worker reads it with chrome.cookies (falling back to the token saved
// on the options page). Throws ExtensionContextLostError once the extension
// was reloaded under this page.
export async function getSession(): Promise<Session> {
  const sid = readCookie('sid')
  if (sid) {
    return { token: sid, host: location.hostname }
  }
  requireExtensionContext()
  const session = await chrome.runtime.sendMessage({ command: 'getToken' })
  if (!session || !session.token) {
    console.log(
      'Apex Debugger:',
      'no Salesforce session found. Log in again, or save a session id in the extension options.'
    )
    return { token: undefined, host: location.hostname }
  }
  return { token: session.token, host: session.host || location.hostname }
}

export async function getToken(): Promise<string | undefined> {
  return (await getSession()).token
}

export function parseDiscoCookie(): {
  orgId: string | undefined
  userId: string | undefined
} {
  const disco = readCookie('disco')
  if (!disco) {
    console.log(
      'Apex Debugger:',
      'disco cookie not found; cannot tell the org and user ids'
    )
    return { orgId: undefined, userId: undefined }
  }
  const ids = disco.split(':')
  return { orgId: ids[1], userId: ids[2] }
}

export function getUserId(): string | undefined {
  return parseDiscoCookie().userId
}

// The Salesforce client for content scripts: calls the API on the page's own
// origin (same-origin, so no CORS) with the session from getSession().
export function pageSalesforce() {
  return createSalesforceClient(
    createRequest({ origin: location.origin, getToken })
  )
}

// The service worker message that opens the full-page log viewer
// (html/app.html) for an org, or focuses the tab that already shows it.
export function openAppMessage(
  orgId: string | undefined,
  userId: string | undefined,
  { token, host }: Session
) {
  return {
    url: `${chrome.runtime.getURL('html/app.html')}?oid=${orgId}&uid=${userId}&sid=${encodeURIComponent(
      token
    )}&host=${encodeURIComponent(host)}`,
    name: `app_${orgId}`,
    command: 'openOrFocusTab'
  }
}

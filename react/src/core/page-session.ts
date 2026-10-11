// Session, org and user of the Salesforce page a content script runs on, and
// API calls made with that session.
import { API, ASYNC_API } from '../api/version'

export const API_PATH = API
export const ASYNC_API_PATH = ASYNC_API

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
// on the options page).
export async function getSession(): Promise<Session> {
  const sid = readCookie('sid')
  if (sid) {
    return { token: sid, host: location.hostname }
  }
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

// Calls the Salesforce API on the current page's origin with the page's
// session. An `X-SFDC-Session` header (any truthy value) gets the session
// instead of Authorization, as the Bulk API expects.
export async function sfRequest(
  path: string,
  method = 'GET',
  headers: Record<string, any> = {},
  body?: BodyInit
): Promise<Response> {
  const token = await getToken()
  if (headers['X-SFDC-Session']) {
    headers['X-SFDC-Session'] = token
  } else {
    headers['Authorization'] = 'Bearer ' + token
  }
  const result = await fetch(location.origin + path, { method, body, headers })
  if (!result.ok) {
    console.log(
      'Apex Debugger:',
      'Make sure Session ID is valid and not expired'
    )
    throw Error(`${result.status} : ${result.statusText}`)
  }
  return result
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

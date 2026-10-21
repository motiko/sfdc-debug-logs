// The transport behind the Salesforce client (client.ts): a function that
// calls one REST path and resolves with the parsed response. Content scripts
// and the app differ only in where they send requests and how they get the
// session id, so both build their request function with createRequest:
//   - content scripts (core/page-session.ts): the page's own origin, token
//     from getSession() (the service worker reads the HttpOnly sid cookie);
//   - the app (global-sf.ts): https://<host> from the URL, token from the URL,
//     refreshed from the service worker after a 401.

export interface SfRequestInit {
  method?: string
  headers?: Record<string, string>
  // A string is sent as is (set its Content-Type in headers); anything else
  // is sent as JSON.
  body?: unknown
  // 'text': resolve with the response body as text. Otherwise JSON responses
  // are parsed, empty ones resolve with null, and others with their text.
  responseType?: 'json' | 'text'
}

export type SfRequest = (path: string, init?: SfRequestInit) => Promise<any>

export class SalesforceError extends Error {
  status: number
  constructor(status: number, statusText: string, detail?: string) {
    super(`${status}: ${statusText}${detail ? ` (${detail})` : ''}`)
    this.name = 'SalesforceError'
    this.status = status
  }
}

// No session id to send: the service worker found no session cookie for the
// org (and none is saved on the options page).
export class NoSessionError extends Error {
  constructor() {
    super('No Salesforce session found')
    this.name = 'NoSessionError'
  }
}

export interface RequestOptions {
  // Where requests go, e.g. "https://acme.my.salesforce.com" (no trailing /).
  origin: string
  // The session id to start with; getToken() is asked when there is none.
  token?: string
  // Returns the current session id. Called for the first request without a
  // token, and once more after a 401 (the session may have been renewed).
  getToken: () => Promise<string | undefined>
  fetch?: typeof fetch
}

export function createRequest({
  origin,
  token,
  getToken,
  fetch: fetchImpl = (...args) => fetch(...args)
}: RequestOptions): SfRequest {
  let current: Promise<string | undefined> | undefined = token
    ? Promise.resolve(token)
    : undefined
  const sessionId = () => (current = current || getToken())
  // After a 401, asks for a new token unless another request already did.
  async function renewed(rejected: string | undefined) {
    if ((await sessionId()) === rejected) current = getToken()
    return sessionId()
  }

  return async function request(path, init = {}) {
    const send = (sid: string | undefined) => {
      const headers: Record<string, string> = {
        Accept: init.responseType === 'text' ? '*/*' : 'application/json',
        ...init.headers,
        Authorization: `Bearer ${sid}`
      }
      let body = init.body
      if (body !== undefined && typeof body !== 'string') {
        body = JSON.stringify(body)
        headers['Content-Type'] =
          headers['Content-Type'] || 'application/json; charset=UTF-8'
      }
      return fetchImpl(origin + path, {
        method: init.method || 'GET',
        headers,
        body: body as BodyInit | undefined
      })
    }
    const sid = await sessionId()
    if (!sid) throw new NoSessionError()
    let response = await send(sid)
    if (response.status === 401) {
      const next = await renewed(sid)
      if (!next) throw new NoSessionError()
      response = await send(next)
    }
    if (!response.ok) {
      throw new SalesforceError(
        response.status,
        response.statusText,
        errorDetail(await response.text().catch(() => ''))
      )
    }
    if (init.responseType === 'text') return response.text()
    const text = await response.text()
    if (!text) return null
    const type = response.headers.get('Content-Type') || ''
    return type.includes('json') ? JSON.parse(text) : text
  }
}

// Salesforce's error body: [{ "message": "...", "errorCode": "..." }].
function errorDetail(body: string): string | undefined {
  try {
    const errors = JSON.parse(body)
    const first = Array.isArray(errors) ? errors[0] : errors
    return first && first.message ? String(first.message) : undefined
  } catch {
    return undefined
  }
}

// The app's Salesforce client, built from the URL that opened html/app.html
// (?oid=&uid=&sid=&host=, see core/page-session.ts openAppMessage). Thunks get
// it as their third argument: (dispatch, getState, sf).
import { createSalesforceClient } from './core/salesforce/client'
import { createRequest } from './core/salesforce/request'

const params = new URL(window.location.href).searchParams
const hostname = params.get('host')

// After a 401, asks the service worker for the org's current session cookie.
async function currentSessionId(): Promise<string | undefined> {
  const session = await chrome.runtime.sendMessage({
    command: 'getToken',
    url: `https://${hostname}/`
  })
  return session && session.token
}

const client = createSalesforceClient(
  createRequest({
    origin: `https://${hostname}`,
    token: params.get('sid') || undefined,
    getToken: currentSessionId
  })
)

const isId = (id: string | null) =>
  /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(id || '')

// The opening page reads the user and org ids from Salesforce's disco cookie,
// which isn't readable on every page (the app is then opened with
// uid=undefined). Ask Salesforce instead in that case, once.
let currentUser: Promise<{ userId: string; orgId: string }> | undefined
function ids() {
  if (isId(params.get('uid')) && isId(params.get('oid'))) {
    return Promise.resolve({
      userId: params.get('uid')!,
      orgId: params.get('oid')!
    })
  }
  currentUser = currentUser || client.currentUser()
  return currentUser
}

const globalSf = {
  ...client,
  hostname,
  getUserId: async () => (await ids()).userId,
  getOrgId: async () => (await ids()).orgId
}

export type AppSalesforce = typeof globalSf

export default globalSf

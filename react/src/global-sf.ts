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

const globalSf = {
  ...createSalesforceClient(
    createRequest({
      origin: `https://${hostname}`,
      token: params.get('sid') || undefined,
      getToken: currentSessionId
    })
  ),
  hostname,
  userId: params.get('uid'),
  orgId: params.get('oid')
}

export type AppSalesforce = typeof globalSf

export default globalSf

// Upload a packaged extension to the Chrome Web Store and submit it for
// review, using the Chrome Web Store API v2.
//
// Usage: node scripts/cws-publish.mjs <zip> <expected-version>
//
// Environment:
//   CWS_ACCESS_TOKEN   OAuth access token with the
//                      https://www.googleapis.com/auth/chromewebstore scope
//   CWS_PUBLISHER_ID   Developer Dashboard > Account > Publisher ID
//   CWS_EXTENSION_ID   the item id
//   CWS_PUBLISH_TYPE   DEFAULT_PUBLISH (go live once approved, the default)
//                      or STAGED_PUBLISH (wait for a manual publish)

import { readFileSync } from 'node:fs'

const [zipPath, expectedVersion] = process.argv.slice(2)
const {
  CWS_ACCESS_TOKEN: token,
  CWS_PUBLISHER_ID: publisherId,
  CWS_EXTENSION_ID: extensionId,
  CWS_PUBLISH_TYPE: publishType = 'DEFAULT_PUBLISH'
} = process.env

if (!zipPath || !expectedVersion || !token || !publisherId || !extensionId) {
  console.error(
    'Usage: node scripts/cws-publish.mjs <zip> <expected-version> ' +
      '(needs CWS_ACCESS_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID)'
  )
  process.exit(2)
}

const item = `publishers/${publisherId}/items/${extensionId}`
// CWS_API_URL only exists to point the script at a mock in tests.
const API = process.env.CWS_API_URL || 'https://chromewebstore.googleapis.com'

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch (e) {
    json = { raw: text }
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

const fetchStatus = () => call(`${API}/v2/${item}:fetchStatus`)

async function upload() {
  console.log(`Uploading ${zipPath} to ${extensionId}...`)
  let result = await call(`${API}/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: readFileSync(zipPath)
  })
  let state = result.uploadState
  let version = result.crxVersion
  // Large packages are processed asynchronously; poll until done.
  for (let i = 0; i < 60 && /IN_PROGRESS/.test(state); i++) {
    await new Promise(r => setTimeout(r, 5000))
    const status = await fetchStatus()
    state = status.lastAsyncUploadState
    version = version || status.submittedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(`Upload did not succeed (uploadState: ${state}): ${JSON.stringify(result)}`)
  }
  if (version && version !== expectedVersion) {
    throw new Error(`Store reports version ${version}, expected ${expectedVersion}`)
  }
  console.log(`Upload succeeded (version ${version || expectedVersion}).`)
}

async function publish() {
  const result = await call(`${API}/v2/${item}:publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType })
  })
  if (result.warningInfo) console.warn('Warnings:', JSON.stringify(result.warningInfo))
  if (['REJECTED', 'CANCELLED'].includes(result.state)) {
    throw new Error(`Submission ${result.state}: ${JSON.stringify(result)}`)
  }
  console.log(`Submitted with ${publishType}; item state: ${result.state}.`)
  if (result.state === 'PENDING_REVIEW') {
    console.log('The update goes live after Chrome Web Store review.')
  }
}

try {
  await upload()
  await publish()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

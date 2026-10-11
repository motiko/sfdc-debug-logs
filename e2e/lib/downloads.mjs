// Catches a file a page downloads: Chrome saves it into a fresh directory
// (CDP Browser.setDownloadBehavior), and the promise resolves with its name
// and text once the download completes.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function captureDownload(page, trigger, { timeoutMs = 20000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'apexdbg-download-'))
  const cdp = await page.browser().target().createCDPSession()
  let timer
  try {
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true })
    const names = new Map()
    const done = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no download within ${timeoutMs}ms`)), timeoutMs)
      cdp.on('Browser.downloadWillBegin', e => names.set(e.guid, e.suggestedFilename))
      cdp.on('Browser.downloadProgress', e => {
        if (e.state === 'completed') {
          clearTimeout(timer)
          resolve(names.get(e.guid))
        } else if (e.state === 'canceled') {
          clearTimeout(timer)
          reject(new Error('download canceled'))
        }
      })
    })
    await trigger()
    const name = await done
    return { name, text: readFileSync(join(dir, name), 'utf8') }
  } finally {
    clearTimeout(timer)
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'default' }).catch(() => {})
    await cdp.detach().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  }
}

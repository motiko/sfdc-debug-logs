// Launches Chrome for Testing (stable) with the chrome/app MV3 extension
// loaded, in a throwaway profile. Branded Chrome ignores --load-extension.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import {
  Browser,
  install,
  resolveBuildId,
  detectBrowserPlatform,
  computeExecutablePath
} from '@puppeteer/browsers'
import { ROOT } from '../../scripts/lib/sf-auth.mjs'

const CACHE_DIR = join(ROOT, '.chrome-test')
const EXTENSION = join(ROOT, 'chrome', 'app')

async function chromeForTesting() {
  const platform = detectBrowserPlatform()
  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable')
  await install({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR })
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR })
}

export async function launchWithExtension() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'apex-dbg-e2e-'))
  const browser = await puppeteer.launch({
    executablePath: await chromeForTesting(),
    headless: process.env.HEADFUL ? false : true,
    userDataDir,
    defaultViewport: { width: 1400, height: 1000 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--load-extension=${EXTENSION}`,
      `--disable-extensions-except=${EXTENSION}`
    ]
  })
  // Chrome for Testing also runs built-in extensions' workers; match ours.
  const swTarget = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().endsWith('/js/background.js'),
    { timeout: 15000 }
  )
  const background = await swTarget.worker()
  const extensionId = new URL(swTarget.url()).host
  const close = async () => {
    await browser.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
  return { browser, background, extensionId, close }
}

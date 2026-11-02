// Launches Chrome for Testing (stable) with the chrome/app MV3 extension
// loaded, in a throwaway profile. Branded Chrome ignores --load-extension.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { Browser, install, resolveBuildId, detectBrowserPlatform, computeExecutablePath } from '@puppeteer/browsers'
import { ROOT } from '../../scripts/lib/sf-auth.mjs'

const CACHE_DIR = join(ROOT, '.chrome-test')
const EXTENSION = join(ROOT, 'chrome', 'app')

async function chromeForTesting() {
  const platform = detectBrowserPlatform()
  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable')
  await install({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR })
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir: CACHE_DIR })
}

// mock: a mock org from e2e/mock/server.mjs. Chrome then resolves only the
// mock org's hosts (to the local server) and accepts its self-signed
// certificate; every other host fails, so nothing reaches a real org.
export async function launchWithExtension({ mock = null } = {}) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'apex-dbg-e2e-'))
  const browser = await puppeteer.launch({
    executablePath: await chromeForTesting(),
    headless: process.env.HEADFUL ? false : true,
    userDataDir,
    defaultViewport: { width: 1400, height: 1000 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--load-extension=${EXTENSION}`,
      `--disable-extensions-except=${EXTENSION}`,
      // GitHub's Ubuntu runners block the user namespaces Chrome's sandbox needs.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      ...(mock ? [`--host-resolver-rules=${mock.resolverRules}`, '--ignore-certificate-errors'] : [])
    ]
  })
  // Chrome for Testing also runs built-in extensions' workers; match ours.
  const swTarget = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().endsWith('/js/build/background.js'),
    { timeout: 15000 }
  )
  const background = await swTarget.worker()
  const extensionId = new URL(swTarget.url()).host
  // Every profile is new, so installing opens the options page's welcome
  // (background.ts runtime.onInstalled) in a tab of its own. Wait for it here,
  // so callers get it deterministically: the e2e flow tests it, the UX audit
  // closes it and opens its own. null if it didn't open.
  const welcomeTarget = await browser
    .waitForTarget(t => t.type() === 'page' && t.url().includes('/html/options.html#welcome'), { timeout: 15000 })
    .catch(() => null)
  const welcome = welcomeTarget ? await welcomeTarget.page() : null
  const close = async () => {
    await browser.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
  return { browser, background, extensionId, welcome, close }
}

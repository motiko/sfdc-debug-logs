// Launches Chrome for Testing 138 (last version that can run the MV2
// extension) with chrome/app loaded, in a throwaway profile.

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
  const buildId = await resolveBuildId(Browser.CHROME, platform, '138')
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
      `--disable-extensions-except=${EXTENSION}`,
      '--disable-features=ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported'
    ]
  })
  const bgTarget = await browser.waitForTarget(t => t.type() === 'background_page', {
    timeout: 15000
  })
  const background = await bgTarget.page()
  const extensionId = new URL(bgTarget.url()).host
  const close = async () => {
    await browser.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
  return { browser, background, extensionId, close }
}

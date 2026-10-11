// Measures how the React app handles a very large debug log (issue #19).
// Not part of `npm test`: it creates a ~20 MB log in the org (Salesforce caps
// logs at 20 MB) and opens it in the app, then reports the time to the first
// rendered line and how long scrolling takes.
//
//   node large-log-perf.mjs                  create a large log, then measure
//   node large-log-perf.mjs --log 07L…       measure an existing log
//   node large-log-perf.mjs --ext <dir>      load another unpacked build of
//                                            chrome/app (e.g. an older one)
//
// Credentials: .env.local (see scripts/lib/sf-auth.mjs). Build first
// (./build.sh).

import { parseArgs } from 'node:util'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'
import { Browser, install, resolveBuildId, detectBrowserPlatform, computeExecutablePath } from '@puppeteer/browsers'
import { login, ROOT } from '../scripts/lib/sf-auth.mjs'
import { Salesforce } from './lib/salesforce.mjs'

const { values: args } = parseArgs({
  options: {
    log: { type: 'string' },
    ext: { type: 'string', default: join(ROOT, 'chrome', 'app') },
    lines: { type: 'string', default: '80000' }
  }
})

const session = await login()
const sf = new Salesforce(session)

// About 250 bytes per USER_DEBUG line; every 50th line is JSON with the user
// id (an expandable, linked entry).
async function createLargeLog(lines) {
  await sf.ensureLogging()
  const marker = `LARGE_LOG_${Date.now()}`
  const apex = `
String filler = '${marker} ' + 'abcdefghij'.repeat(18);
String payload = JSON.serialize(new Map<String, Object>{ 'user' => UserInfo.getUserId(), 'n' => 42 });
for (Integer i = 0; i < ${lines}; i++) {
  if (Math.mod(i, 50) == 0) System.debug(payload);
  else System.debug(i + ' ' + filler);
}
System.debug('${marker} END');
`
  const since = new Date(Date.now() - 60000)
  const res = await sf.request(`/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apex)}`)
  if (!res.compiled) throw new Error(`Apex compile error: ${res.compileProblem}`)
  if (!res.success) console.log(`Apex stopped early (${res.exceptionMessage}); measuring the log it wrote`)
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    const [log] = await sf.query(
      `SELECT Id, LogLength FROM ApexLog WHERE LogUserId = '${session.userId}' ` +
        `AND StartTime >= ${since.toISOString()} AND Operation LIKE '%executeAnonymous%' ` +
        `ORDER BY LogLength DESC LIMIT 1`
    )
    if (log && log.LogLength > 1e6) return log
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('the large log did not show up')
}

const log = args.log
  ? (await sf.query(`SELECT Id, LogLength FROM ApexLog WHERE Id = '${args.log}'`))[0]
  : await createLargeLog(Number(args.lines))
console.log(`log ${log.Id}: ${(log.LogLength / 1e6).toFixed(1)} MB`)

const platform = detectBrowserPlatform()
const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable')
const cacheDir = join(ROOT, '.chrome-test')
await install({ browser: Browser.CHROME, buildId, cacheDir })
const extension = resolve(args.ext)
const userDataDir = mkdtempSync(join(tmpdir(), 'apex-dbg-perf-'))
const browser = await puppeteer.launch({
  executablePath: computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir }),
  headless: process.env.HEADFUL ? false : true,
  userDataDir,
  defaultViewport: { width: 1400, height: 1000 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`, '--enable-precise-memory-info'],
  protocolTimeout: 600000
})

try {
  const worker = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().endsWith('/js/build/background.js'),
    { timeout: 15000 }
  )
  const extensionId = new URL(worker.url()).host
  const page = await browser.newPage()
  page.setDefaultTimeout(300000)
  await page.evaluateOnNewDocument(() => {
    window.__longTasks = []
    new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(e => e.duration))).observe({
      type: 'longtask',
      buffered: true
    })
  })
  const params = new URLSearchParams({
    oid: session.orgId,
    uid: session.userId,
    sid: session.sessionId,
    host: new URL(session.instance).hostname
  })
  await page.goto(`chrome-extension://${extensionId}/html/app.html?${params}#/logs/${log.Id}`)

  // First line of the log body on screen.
  await page.waitForFunction(
    () => {
      const line = [...document.querySelectorAll('pre > div')].find(d => /USER_DEBUG/.test(d.textContent))
      if (!line) return false
      window.__firstRender = performance.now()
      return true
    },
    { polling: 'raf', timeout: 300000 }
  )
  const load = await page.evaluate(() => {
    const body = performance.getEntriesByType('resource').find(e => /\/ApexLog\/[^/]+\/Body/.test(e.name))
    const tasks = window.__longTasks
    return {
      downloaded: body ? Math.round(body.responseEnd) : null,
      firstRender: Math.round(window.__firstRender),
      longTasks: tasks.length,
      longestTask: Math.round(Math.max(0, ...tasks)),
      domNodes: document.getElementsByTagName('*').length,
      heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6)
    }
  })
  await page.evaluate(() => (window.__longTasks = []))

  // Jumps through the log (like dragging the scrollbar), then wheel-scrolls.
  // Each step waits for the next two frames, i.e. until it is painted.
  const scroll = await page.evaluate(async () => {
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    let scroller = document.querySelector('pre')
    while (
      scroller &&
      !(scroller.scrollHeight > scroller.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))
    )
      scroller = scroller.parentElement
    const steps = []
    const max = scroller.scrollHeight - scroller.clientHeight
    for (let i = 1; i <= 20; i++) {
      const start = performance.now()
      scroller.scrollTop = (max * i) / 20
      await frame()
      steps.push(performance.now() - start)
    }
    scroller.scrollTop = 0
    await frame()
    for (let i = 0; i < 40; i++) {
      const start = performance.now()
      scroller.scrollBy(0, 400)
      await frame()
      steps.push(performance.now() - start)
    }
    scroller.scrollTop = scroller.scrollHeight
    await frame()
    await frame()
    const lines = [...document.querySelectorAll('pre > div')]
    const sorted = [...steps].sort((a, b) => a - b)
    return {
      steps: steps.length,
      medianStep: Math.round(sorted[Math.floor(sorted.length / 2)]),
      slowestStep: Math.round(sorted[sorted.length - 1]),
      lastLine: lines.length ? lines[lines.length - 1].textContent.trim().slice(-60) : null,
      longTasks: window.__longTasks.length,
      longestTask: Math.round(Math.max(0, ...window.__longTasks))
    }
  })
  console.log(JSON.stringify({ extension, load, scroll }, null, 2))
} finally {
  await browser.close()
  rmSync(userDataDir, { recursive: true, force: true })
}

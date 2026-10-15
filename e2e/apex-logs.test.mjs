// End-to-end flow: run Apex in the org, then check the resulting debug log in
// both of the extension's views:
//   - classic view: the content script on Salesforce's log detail page
//     (react/src/extension/debug-log-page.ts)
//   - React app: html/app.html opened with Shift+W (react/src/pages/logs)
// For each view: the log is visible, it can be searched, and every theme
// (react/src/core/log/themes.ts, shared by both views) applies its color and
// font rules to every event type in the log.
//
// Credentials: .env.local (see scripts/lib/sf-auth.mjs). Run: npm test (in e2e/)
// Offline, against the mock org (e2e/mock/): npm run test:mock (SF_MOCK=1).
// At the end it prints how many Salesforce API requests the run made.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frontdoorUrl } from '../scripts/lib/sf-auth.mjs'
import { startRun, MOCK } from './lib/run.mjs'
import { gotoLightning } from './lib/lightning.mjs'
import { launchWithExtension } from './lib/browser.mjs'
import {
  logThemes,
  CLASSIC_CATEGORY_CLASS,
  eventCategory,
  computedCategoryStyle,
  toRgb,
  uiColors
} from './lib/styles.mjs'

const MARKER = `E2E_MARKER_${Date.now()}`
// Log text is untrusted (System.debug of a public Site's input): the views must
// show it as text. The id gets linked; the markup must never become an <img>.
const XSS = '<img src=x onerror="window.__xss=1">'
const APEX = `
String marker = '${MARKER}';
System.debug(marker);
System.debug(JSON.serialize(new Map<String, Object>{ 'marker' => marker, 'n' => 42 }));
List<User> users = [SELECT Id, Name FROM User LIMIT 1];
System.debug(marker + ' users ' + users);
System.debug('${XSS} ' + UserInfo.getUserId() + ' xss ' + marker);
try { Integer x = 1 / 0; } catch (Exception e) { System.debug('caught ' + e.getMessage()); }
for (Integer i = 0; i < 3; i++) { List<User> again = [SELECT Id FROM User LIMIT 1]; }
${
  // DML only in the mock org: it changes no data there.
  MOCK ? "insert new List<Account>{ new Account(Name = 'E2E A'), new Account(Name = 'E2E B') };" : ''
}
`
// A log long enough that the app renders only the lines in view
// (RENDER_ALL_UP_TO in react/src/pages/logs/components/parsed-log.js). Its
// marker doesn't contain MARKER, so searches for MARKER don't match it.
const LONG_MARKER = `E2E_LONG_${Date.now()}`
const LONG_APEX = `
for (Integer i = 0; i < 2500; i++) { System.debug('${LONG_MARKER} line ' + i); }
System.debug('${LONG_MARKER} end');
`

// A log over 2.5 MB: earlier versions hid such logs behind a default size
// filter (docs/ux/baseline-review.md B1). About 3 MB of USER_DEBUG lines.
const BIG_MARKER = `E2E_BIG_${Date.now()}`
const BIG_APEX = `
String filler = '${BIG_MARKER} ' + 'abcdefghij'.repeat(100);
for (Integer i = 0; i < 2800; i++) { System.debug(filler); }
`

const ARTIFACTS = join(dirname(fileURLToPath(import.meta.url)), 'artifacts')

let run, session, sf, log, longLog, bigLog, ext

before(async () => {
  run = await startRun()
  sf = run.sf
  await sf.ensureLogging()
  // A reused session that had expired was renewed by ensureLogging.
  session = run.session
  const since = new Date(Date.now() - 60000)
  await sf.executeAnonymous(BIG_APEX)
  await sf.executeAnonymous(LONG_APEX)
  await sf.executeAnonymous(APEX)
  // One search for the three logs: each body is downloaded once.
  const found = await sf.findLogs([MARKER, LONG_MARKER, BIG_MARKER], { since })
  log = found[MARKER]
  longLog = found[LONG_MARKER]
  bigLog = found[BIG_MARKER]
  // No token is saved on the options page: the extension has to find the
  // session itself, from the HttpOnly sid cookie that frontdoor.jsp sets.
  ext = await run.launch()
  await recordWorkerMessages()
})

after(async () => {
  if (!run) return
  run.report(run.mock ? 'Salesforce requests of this run (mock org)' : 'Salesforce requests of this run')
  await run.close()
})

// Saves a screenshot and console log for debugging failures (uploaded by CI).
async function saveArtifacts(page, name, lines) {
  mkdirSync(ARTIFACTS, { recursive: true })
  await page.screenshot({ path: join(ARTIFACTS, `${name}.png`), fullPage: true }).catch(() => {})
  const url = page.url().replace(/sid=[^&]+/, 'sid=<redacted>')
  writeFileSync(join(ARTIFACTS, `${name}.log`), [`url: ${url}`, ...lines].join('\n') + '\n')
}

function collectPageErrors(page) {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

// Records every message the content scripts send to the service worker
// (command, sender host/path, frame, time), so the test can tell when a page's
// shortcuts are bound and whether a key press reached the extension. Only
// observes: the listener returns nothing, so the worker's own router answers.
// Installed right after launch, before any Salesforce page loads.
async function recordWorkerMessages() {
  await ext.background.evaluate(() => {
    if (globalThis.__e2eMessages) return
    globalThis.__e2eMessages = []
    chrome.runtime.onMessage.addListener((request, sender) => {
      const url = sender.tab ? new URL(sender.tab.url) : null
      globalThis.__e2eMessages.push({
        command: request.command,
        host: url && url.host,
        path: url && url.pathname,
        frameId: sender.frameId,
        time: Date.now()
      })
    })
  })
}

const workerMessages = () => ext.background.evaluate(() => globalThis.__e2eMessages || [])

const redact = text =>
  text
    .replace(/sid=[^&\s"]+/g, 'sid=<redacted>')
    .split(session.sessionId)
    .join('<redacted>')

const delay = ms => new Promise(r => setTimeout(r, ms))

// Where keyboard input on the page would go, for retries and failure reports.
const keyboardState = page =>
  page.evaluate(() => {
    const el = document.activeElement
    return {
      url: location.host + location.pathname,
      readyState: document.readyState,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      activeElement: el ? `${el.tagName}${el.id ? '#' + el.id : ''}` : 'none',
      keydowns: (window.__e2eKeydowns || []).slice(-4)
    }
  })

// Opens the app with the real Shift+W shortcut on a Salesforce page and
// returns the app page. Saves artifacts as <name>.png/.log on failure.
//
// Shift+W is bound by shortcuts.ts (Mousetrap) only once the content script's
// getShortcuts message to the service worker is answered, and Mousetrap only
// sees keys that reach the top document while no input, select or iframe has
// focus (content scripts don't run in frames); other key presses are silently
// lost. So: wait until this document has asked the worker for its shortcuts,
// then before each press bring the tab to the front and move focus to the top
// document, and count the shortcut as fired once openApp's focusAppTab message
// reaches the worker (getToken isn't specific: the log list page sends it too).
async function openAppWithShiftW(sfPage, consoleLog, name) {
  const steps = []
  const step = (msg, data) => steps.push(`${new Date().toISOString()} ${msg}${data ? ' ' + JSON.stringify(data) : ''}`)
  const appTarget = ext.browser.waitForTarget(t => t.url().includes('/html/app.html'), { timeout: 90000 })
  let opened = false
  appTarget.then(
    () => (opened = true),
    () => {}
  )
  const fromThisPage = async (command, since) => {
    // The page may be mid-navigation (e.g. a Lightning redirect).
    const host = await sfPage.evaluate(() => location.host).catch(() => null)
    return (await workerMessages()).find(
      m => m.command === command && m.host === host && m.frameId === 0 && m.time >= since
    )
  }
  try {
    const loadedAt = await sfPage.evaluate(() => Math.floor(performance.timeOrigin))
    const boundBy = Date.now() + 30000
    while (!(await fromThisPage('getShortcuts', loadedAt))) {
      if (Date.now() > boundBy) throw new Error('the content script never asked the service worker for shortcuts')
      await delay(250)
    }
    // The answer is a storage read; Mousetrap binds as soon as it arrives.
    await delay(500)
    step('shortcuts requested by this page')

    for (let attempt = 1; !opened; attempt++) {
      if (attempt > 6) throw new Error('no key press reached the shortcut handler')
      await sfPage.bringToFront()
      await sfPage.evaluate(() => {
        if (!window.__e2eKeydowns) {
          window.__e2eKeydowns = []
          document.addEventListener('keydown', e => window.__e2eKeydowns.push(`${e.key}@${e.target.tagName}`), true)
        }
        const el = document.activeElement
        if (el && el !== document.body) el.blur()
        window.focus()
      })
      step(`press ${attempt}`, await keyboardState(sfPage))
      const pressedAt = Date.now()
      await sfPage.keyboard.down('Shift')
      await sfPage.keyboard.press('KeyW')
      await sfPage.keyboard.up('Shift')
      const firedBy = Date.now() + 5000
      while (!opened && Date.now() < firedBy && !(await fromThisPage('focusAppTab', pressedAt))) await delay(200)
      if (opened || (await fromThisPage('focusAppTab', pressedAt))) {
        step('shortcut fired')
        break
      }
      step(`press ${attempt} not handled`, await keyboardState(sfPage))
    }
    return await (await appTarget).page()
  } catch (e) {
    step(`failed: ${e.message}`)
    const state = await keyboardState(sfPage).catch(err => ({ error: err.message }))
    const messages = await workerMessages().catch(() => [])
    await saveArtifacts(
      sfPage,
      name,
      [
        `keyboard: ${JSON.stringify(state)}`,
        '--- steps',
        ...steps,
        '--- messages to the service worker',
        ...messages.map(
          m => `${new Date(m.time).toISOString()} ${m.command} from ${m.host}${m.path} frame ${m.frameId}`
        ),
        '--- console',
        ...consoleLog
      ].map(redact)
    )
    throw new Error(`Shift+W did not open the app (${e.message}); see e2e/artifacts/${name}.*`)
  }
}

const classicUrl = id => `/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${id}`

test('logs in with the OAuth 2.0 JWT bearer flow', { skip: !MOCK && 'mock org only' }, () => {
  // startRun() logged in to the mock org through scripts/lib/sf-auth.mjs
  // login() with an External Client App's key, the way the real org is
  // reached once SF_CLIENT_ID is set; the browser uses that session through
  // frontdoor.jsp in every test below.
  const { byKind } = run.mock.org.stats()
  assert.equal(byKind['oauth token'], 1, 'one token request')
  assert.equal(byKind['soap login'], undefined, 'no SOAP login')
  assert.equal(session.sessionId, run.mock.org.sessionId, 'the access token is the session')
  assert.equal(session.userId, run.mock.org.user.Id, 'user id from the identity URL')
  assert.equal(session.orgId, run.mock.org.orgId, 'org id from the identity URL')
})

test('classic log view', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.goto(frontdoorUrl(session, classicUrl(log.Id)), { waitUntil: 'networkidle2' })
  await page.waitForSelector('#debugText div', { timeout: 20000 })

  await t.test('log is visible', async () => {
    const visible = await page.evaluate(marker => {
      const line = [...document.querySelectorAll('#debugText .debug')].find(d => d.textContent.includes(marker))
      if (!line) return false
      const box = line.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    }, MARKER)
    assert.ok(visible, 'USER_DEBUG line with the marker is rendered and visible')
  })

  await t.test('log is searchable', async () => {
    // The classic view has no search box of its own; it marks lines with
    // the "searchable" class and relies on the browser's find.
    const found = await page.evaluate(marker => window.find(marker), MARKER)
    assert.ok(found, 'browser find locates the marker')
    const searchable = await page.$$eval('#debugText .searchable', els => els.length)
    assert.ok(searchable > 0, 'log lines are marked searchable')
  })

  await t.test('log covers the styled event types', async () => {
    // The Apex makes no callout; every other category is in the log.
    const categories = Object.entries(CLASSIC_CATEGORY_CLASS)
      .filter(([category]) => category !== 'callout')
      .map(([, className]) => className)
    const present = await page.evaluate(
      cats => cats.filter(c => document.querySelector(`#debugText div.${c}`)),
      categories
    )
    assert.deepEqual(present, categories)
  })

  for (const theme of Object.values(logThemes)) {
    await t.test(`theme "${theme.name}" applies to every event type`, async () => {
      await page.select('#styleSelection', theme.name)
      const classes = Object.entries(CLASSIC_CATEGORY_CLASS)
      const actual = await page.evaluate(
        classNames => {
          const root = document.querySelector('#debugText')
          const result = { className: root.className, background: getComputedStyle(root).backgroundColor, classes: {} }
          for (const cls of classNames) {
            const el = root.querySelector(`div.${cls}`)
            if (!el) continue
            const style = getComputedStyle(el)
            result.classes[cls] = {
              color: style.color,
              'font-weight': style.fontWeight,
              'font-style': style.fontStyle
            }
          }
          return result
        },
        classes.map(([, cls]) => cls)
      )
      assert.equal(actual.className, theme.name)
      assert.equal(actual.background, toRgb(theme.background), 'background color')
      const failures = []
      for (const [category, cls] of classes) {
        if (!actual.classes[cls]) continue
        for (const [prop, value] of Object.entries(computedCategoryStyle(theme.categories[category]))) {
          if (!actual.classes[cls][prop].startsWith(value)) {
            failures.push(`.${cls} (${category}) ${prop}: expected ${value}, got ${actual.classes[cls][prop]}`)
          }
        }
      }
      assert.deepEqual(failures, [])
    })
  }

  await t.test('log text is shown as text, never parsed as HTML', async () => {
    const xssLine = () =>
      page.evaluate(
        (marker, userId) => {
          const line = [...document.querySelectorAll('#debugText .debug')].find(d =>
            d.textContent.includes(`xss ${marker}`)
          )
          if (!line) return null
          return {
            text: line.textContent,
            expanded: Boolean(line.querySelector('.expandUserDebugBtn.expanded')),
            idLinks: [...line.querySelectorAll('a')].filter(a => a.textContent === userId).length,
            images: document.querySelectorAll('#debugText img').length,
            // page.evaluate runs in the page's main world, where an injected
            // onerror handler would run.
            xss: window.__xss
          }
        },
        MARKER,
        session.userId
      )
    // The expand button is added after load; HTML-looking USER_DEBUGs get one.
    await page.waitForSelector('#debugText .expandUserDebugBtn', { timeout: 10000 })
    const collapsed = await xssLine()
    assert.ok(collapsed, 'the USER_DEBUG line with the markup is rendered')
    assert.ok(collapsed.text.includes(XSS), 'markup is shown literally')
    assert.equal(collapsed.idLinks, 1, 'the user id is a link')
    // Expanding beautifies the markup and links legal ids again.
    await page.evaluate(marker => {
      const line = [...document.querySelectorAll('#debugText .debug')].find(d =>
        d.textContent.includes(`xss ${marker}`)
      )
      line.querySelector('.expandUserDebugBtn').click()
    }, MARKER)
    await page.waitForFunction(
      marker =>
        [...document.querySelectorAll('#debugText .debug')]
          .find(d => d.textContent.includes(`xss ${marker}`))
          .querySelector('.expandUserDebugBtn.expanded'),
      { timeout: 5000 },
      MARKER
    )
    await new Promise(resolve => setTimeout(resolve, 500))
    const expanded = await xssLine()
    assert.ok(expanded.text.includes('onerror="window.__xss=1"'), 'expanded markup is shown literally')
    assert.equal(expanded.idLinks, 1, 'the user id is a link after expanding')
    assert.equal(expanded.images, 0, 'no <img> element was created from log text')
    assert.equal(expanded.xss, undefined, 'no handler from log text ran')
  })

  await t.test('font size applies', async () => {
    await page.select('#fontSelection', '14')
    const size = await page.$eval('#debugText', el => getComputedStyle(el).fontSize)
    assert.equal(size, '14px')
  })

  if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
  await page.close()
})

test('classic log list', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.goto(frontdoorUrl(session, '/setup/ui/listApexTraces.apexp'), { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[type="number"][min="25"]', { timeout: 30000 })

  await t.test('reloading lists the newest logs, for all users', async () => {
    // Changing "Maximum logs per Page" reloads the table from the API.
    await page.$eval('input[type="number"][min="25"]', el => {
      el.value = '25'
      el.dispatchEvent(new Event('change'))
    })
    await page.waitForSelector(`tr[data-id="${log.Id}"]`, { timeout: 30000 })
    const ids = await page.$$eval('tr[data-id]', trs => trs.map(tr => tr.dataset.id))
    // Loading Setup pages can itself create logs, so allow a few newer ones.
    const newest = (await sf.query('SELECT Id FROM ApexLog ORDER BY LastModifiedDate DESC LIMIT 5')).map(r => r.Id)
    assert.ok(newest.includes(ids[0]), 'the first row is one of the newest logs, not the oldest')
    const userLink = await page.$eval(`tr[data-id="${log.Id}"] td:nth-child(2) a`, a => a.getAttribute('href'))
    assert.equal(userLink, `/${session.userId}`, 'user name links to the user')
    // Cells hold the field values as plain text (no HTML parsing of log data).
    const operation = await page.$eval(`tr[data-id="${log.Id}"] td:nth-child(5)`, td => ({
      text: td.textContent,
      elements: td.children.length
    }))
    assert.deepEqual(operation, { text: log.Operation, elements: 0 }, 'operation cell is plain text')
  })

  if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
  await page.close()
})

test('React log viewer', async t => {
  // Open the app the way users do: Shift+W on a Salesforce page.
  const sfPage = await ext.browser.newPage()
  const consoleLog = []
  sfPage.on('console', m => consoleLog.push(`page ${m.type()}: ${m.text()}`))
  sfPage.on('pageerror', e => consoleLog.push(`page error: ${e.message}`))
  ext.background.on('console', m => consoleLog.push(`worker ${m.type()}: ${m.text()}`))
  await sfPage.goto(frontdoorUrl(session, '/setup/ui/listApexTraces.apexp'), {
    waitUntil: 'networkidle2'
  })
  // frontdoor.jsp can still be redirecting when goto resolves; key presses
  // during that navigation are lost.
  await sfPage.waitForFunction(
    () => location.pathname.includes('listApexTraces') && document.readyState === 'complete',
    { timeout: 30000 }
  )
  const app = await openAppWithShiftW(sfPage, consoleLog, 'shift-w')
  // Network failures (e.g. unreachable optional services) are not page bugs.
  const errors = collectPageErrors(app)
  await app.setViewport({ width: 1400, height: 1000 })
  // Menus and selects close when their page loses focus: keep the app in front.
  await app.bringToFront()
  // Start in light mode (the dark mode check switches explicitly), without
  // animations, so menus and panels are where they end up when clicked.
  await app.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ])

  // The log grid's rows carry their log id.
  const rowIds = () => app.$$eval('[role="grid"] [data-log-id]', rows => rows.map(r => r.dataset.logId))
  const rowTexts = () => app.$$eval('[role="grid"] [data-log-id]', rows => rows.map(r => r.innerText))
  const listCount = () => app.$eval('[data-testid="list-count"]', el => el.textContent)
  // A select: MUI renders a combobox named by its label.
  const combobox = label => `::-p-aria([name="${label}"][role="combobox"])`
  const option = text => `::-p-xpath(//li[@role="option" and normalize-space()="${text}"])`
  const chooseOption = async (label, text) => {
    await app.click(combobox(label))
    await app.waitForSelector(option(text), { visible: true })
    await app.click(option(text))
    // Until the menu and its backdrop are gone, clicks land on them.
    await app.waitForSelector('[role="listbox"]', { hidden: true })
    await delay(200)
  }
  const dialog = name => `::-p-aria([name="${name}"][role="dialog"])`
  const SEARCH = '#search'
  const search = async term => {
    // Select the previous term so typing replaces it.
    await app.click(SEARCH)
    await app.$eval(SEARCH, el => el.select())
    await app.type(SEARCH, term)
    // Live search (debounced): wait for this term's persistent result.
    await app.waitForFunction(
      term => {
        const count = document.querySelector('[data-testid="list-count"]')
        return count && count.textContent.includes(`match “${term}”`)
      },
      { timeout: 120000 },
      term
    )
  }
  const openMenuItem = async name => {
    await app.click('::-p-aria([name="More actions"][role="button"])')
    const item = `::-p-aria([name="${name}"][role="menuitem"])`
    await app.waitForSelector(item, { visible: true })
    await app.click(item)
    await app.waitForSelector('[role="menu"]', { hidden: true })
    await delay(200)
  }

  await t.test('session comes from the HttpOnly cookie, not a saved token', async () => {
    const pageSeesSid = await sfPage.evaluate(() => /(^|;\s*)sid=/.test(document.cookie))
    assert.equal(pageSeesSid, false, 'sid cookie is HttpOnly, so content scripts cannot read it')
    const { token } = await ext.background.evaluate(() => chrome.storage.local.get('token'))
    assert.equal(token, undefined, 'no token saved on the options page')
    const appUrl = new URL(app.url())
    assert.ok(appUrl.searchParams.get('sid'), 'Shift+W passes a session id to the app')
    assert.equal(appUrl.searchParams.get('host'), new URL(session.instance).hostname)
  })

  await t.test('log is listed', async () => {
    await app.waitForSelector(`[role="grid"] [data-log-id="${log.Id}"]`, { timeout: 30000 })
  })

  await t.test('no hidden default filter: a log over 2.5 MB is listed', async () => {
    assert.ok(bigLog.LogLength > 2_500_000, `the big log has ${bigLog.LogLength} bytes`)
    assert.ok((await rowIds()).includes(bigLog.Id), 'the big log is in the list')
    const chips = await app.$$eval('[aria-label="Active filters"] li', els => els.length)
    assert.equal(chips, 0, 'no filter is active when the app opens')
  })

  await t.test('light mode: light surfaces, dark text, readable header', async () => {
    const colors = await app.evaluate(() => {
      const cell = document.querySelector('[role="grid"] [data-log-id] td')
      return {
        body: getComputedStyle(document.body).backgroundColor,
        header: getComputedStyle(document.querySelector('header')).backgroundColor,
        headerText: getComputedStyle(document.querySelector('header h1')).color,
        cellText: getComputedStyle(cell).color
      }
    })
    assert.equal(colors.body, toRgb(uiColors.light.bg), 'page background')
    assert.equal(colors.header, toRgb(uiColors.light.surface), 'header background')
    assert.equal(colors.headerText, toRgb(uiColors.light.text), 'header text')
    assert.equal(colors.cellText, toRgb(uiColors.light.text), 'list text')
  })

  await t.test('search finds the log and hides non-matching ones', async () => {
    await search(MARKER)
    assert.deepEqual(await rowIds(), [log.Id], 'only the log containing the marker remains')
    await search(MARKER.toLowerCase())
    assert.deepEqual(await rowIds(), [log.Id], 'search ignores case')
    assert.match(await listCount(), /^1 of \d+ logs match “/, 'the result stays visible')
    await search(`NO_SUCH_TEXT_${Date.now()}`)
    assert.equal((await rowIds()).length, 0, 'an unknown term matches no logs')
    await app.waitForSelector('::-p-text(No logs contain)')
    await app.focus(SEARCH)
    await app.keyboard.press('Escape')
    await app.waitForFunction(() => document.querySelectorAll('[role="grid"] [data-log-id]').length > 1)
    assert.match(await listCount(), /^\d+ logs$/, 'clearing the search shows every log again')
  })

  await t.test('operation filter reloads only matching logs', async () => {
    const reloaded = async () => {
      await app.waitForFunction(
        () =>
          !document.querySelector('[aria-label="Loading logs"]') &&
          document.querySelectorAll('[role="grid"] [data-log-id]').length > 0,
        { timeout: 30000 }
      )
    }
    const errorsBefore = errors.length
    await app.click('::-p-aria([name="Filters"][role="button"])')
    await app.waitForSelector(dialog('Filters'), { visible: true })
    const shortOp = log.Operation.split('/').filter(Boolean).pop()
    await chooseOption('Operation', shortOp)
    await app.click(`${dialog('Filters')} ::-p-aria([name="Done"][role="button"])`)
    await app.waitForSelector(dialog('Filters'), { hidden: true })
    await reloaded()
    const chip = `::-p-aria([name="Remove filter Operation: ${shortOp}"])`
    await app.waitForSelector(chip, { visible: true })
    const listed = await rowTexts()
    assert.ok(
      listed.every(r => r.includes(shortOp)),
      `every row is a ${shortOp} log`
    )
    assert.match(await listCount(), /^\d+ of \d+ logs$/, 'the count says the list is filtered')
    await app.click(chip)
    await app.waitForSelector(chip, { hidden: true })
    await reloaded()
    assert.deepEqual(errors.slice(errorsBefore), [], 'no page errors while filtering')
  })

  await t.test('auto-refresh lists a new log without a reload, keeping the current row', async () => {
    const chooseInterval = async (current, label) => {
      await app.click(`::-p-aria([name="Auto-refresh: ${current}"][role="button"])`)
      const item = `::-p-aria([name="${label}"][role="menuitemradio"])`
      await app.waitForSelector(item, { visible: true })
      await app.click(item)
      await app.waitForSelector('[role="menu"]', { hidden: true })
      await delay(200)
    }
    await chooseInterval('Off', 'Every 10 s')
    // Logging is on (ensureLogging) and the tab is in front: it runs.
    await app.waitForSelector('::-p-aria([name="Auto-refresh: 10 s"][role="button"])')
    await app.waitForFunction(
      () =>
        document.querySelector('[data-testid="auto-refresh-status"]')?.textContent ===
        'Checking for new logs every 10 s',
      { timeout: 10000 }
    )
    const before = await rowIds()
    // The user is on the second row: it stays the current, focused row.
    const current = before[1]
    await app.focus(`[role="grid"] [data-log-id="${current}"]`)
    const marker = `E2E_AUTO_${Date.now()}`
    await sf.executeAnonymous(`System.debug('${marker}');`)
    await app.waitForFunction(
      known =>
        [...document.querySelectorAll('[role="grid"] [data-log-id]')].some(r => !known.includes(r.dataset.logId)),
      { timeout: 45000 },
      before
    )
    const after = await rowIds()
    const added = after.filter(id => !before.includes(id))
    assert.ok(added.length >= 1, 'a new row was added')
    assert.ok(added.includes(after[0]), 'the new log is on top')
    const newRow = await app.$eval(`[role="grid"] [data-log-id="${after[0]}"]`, r => r.innerText)
    assert.match(newRow, /New/, 'the new row is marked')
    await app.waitForFunction(
      () => /^\d+ new logs?$/.test(document.querySelector('[data-testid="auto-refresh-announcement"]').textContent),
      { timeout: 5000 }
    )
    const live = await app.$eval('[data-testid="auto-refresh-announcement"]', el => el.getAttribute('aria-live'))
    assert.equal(live, 'polite', 'new logs are announced politely')
    const focus = await app.evaluate(() => ({
      id: document.activeElement.dataset.logId,
      tabIndex: document.activeElement.tabIndex
    }))
    assert.deepEqual(focus, { id: current, tabIndex: 0 }, 'focus and the current row stay on the same log')
    assert.equal(new URL(app.url()).hash, '', 'no log was opened')
    // The mock org counts the requests: none while the tab is hidden or
    // auto-refresh is off.
    const queries = () =>
      run.mock ? run.mock.org.requests.filter(r => r.source === 'browser' && r.kind === 'tooling query').length : 0
    if (run.mock) {
      await sfPage.bringToFront()
      // Hidden pages don't run animation frames: poll by time.
      await app.waitForFunction(() => document.visibilityState === 'hidden', { timeout: 5000, polling: 200 })
      const hidden = queries()
      await delay(12000)
      assert.equal(queries(), hidden, 'no polls while the tab is in the background')
      await app.bringToFront()
      // More than an interval passed: it checks once, right away.
      await app.waitForFunction(() => document.visibilityState === 'visible', { polling: 200 })
      const deadline = Date.now() + 5000
      while (queries() === hidden && Date.now() < deadline) await delay(200)
      assert.equal(queries(), hidden + 1, 'one poll when the tab is back in front')
    }
    await chooseInterval('10 s', 'Off')
    await app.waitForSelector('[data-testid="auto-refresh-status"]', { hidden: true })
    if (run.mock) {
      const off = queries()
      await delay(12000)
      assert.equal(queries(), off, 'no polls while auto-refresh is off')
    }
  })

  await t.test('keyboard: Tab reaches a log row and Enter opens it', async () => {
    await app.focus(SEARCH)
    let rowId = null
    for (let i = 0; i < 12 && !rowId; i++) {
      await app.keyboard.press('Tab')
      rowId = await app.evaluate(() => document.activeElement.dataset.logId || null)
    }
    assert.ok(rowId, 'a log row takes focus with Tab')
    const focusVisible = await app.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
    assert.notEqual(focusVisible, 'none', 'the focused row shows a focus ring')
    await app.keyboard.press('ArrowDown')
    const next = await app.evaluate(() => document.activeElement.dataset.logId || null)
    assert.ok(next && next !== rowId, 'the down arrow moves to the next row')
    await app.keyboard.press('Enter')
    await app.waitForFunction(id => location.hash === `#/logs/${id}`, { timeout: 5000 }, next)
    await app.evaluate(() => (location.hash = '#/'))
    await app.waitForSelector('[role="grid"] thead')
  })

  await t.test('delete dialog shows scope and count, and Cancel deletes nothing', async () => {
    const countBefore = (await sf.query(`SELECT Id FROM ApexLog WHERE Id = '${log.Id}'`)).length
    await openMenuItem('Delete logs…')
    const DELETE = dialog('Delete debug logs')
    await app.waitForSelector(DELETE, { visible: true })
    // Counts load after the dialog opens.
    await app.waitForFunction(
      () => /Only my logs \(\d[\d,]*\)/.test(document.querySelector('[role="dialog"]').innerText),
      {
        timeout: 30000
      }
    )
    const state = await app.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const radios = [...d.querySelectorAll('input[type="radio"]')]
      return {
        text: d.innerText,
        checked: radios.filter(r => r.checked).map(r => r.value),
        confirm: [...d.querySelectorAll('button')].map(b => b.textContent).find(t => /^Delete/.test(t))
      }
    })
    assert.deepEqual(state.checked, ['mine'], 'only my logs is the default scope')
    assert.match(state.text, /All users’ logs in \S+ \(\d[\d,]*\)/, 'the org-wide scope shows its count')
    assert.match(state.confirm, /^Delete [\d,]+ logs?$/, 'the confirm button names the action and count')
    await app.click(`${DELETE} ::-p-aria([name="Cancel"][role="button"])`)
    await app.waitForSelector(DELETE, { hidden: true })
    await delay(1000)
    const countAfter = (await sf.query(`SELECT Id FROM ApexLog WHERE Id = '${log.Id}'`)).length
    assert.equal(countAfter, countBefore, 'the log still exists')
    assert.ok((await rowIds()).includes(log.Id), 'the log is still listed')
  })

  await t.test('a confirmation toast covers no header control, and the menu opens under it', async () => {
    // Extending logging (on since ensureLogging) shows a confirmation.
    await app.click('::-p-xpath(//header//button[starts-with(normalize-space(), "Logging on")])')
    const extend = '::-p-aria([name="Extend to 24 hours from now"][role="menuitem"])'
    await app.waitForSelector(extend, { visible: true })
    await app.click(extend)
    await app.waitForSelector('[role="menu"]', { hidden: true })
    const TOAST = '[data-testid="toast"]'
    await app.waitForSelector(TOAST, { visible: true, timeout: 30000 })
    const state = await app.evaluate(() => {
      const toast = document.querySelector('[data-testid="toast"]')
      const rect = toast.getBoundingClientRect()
      const header = document.querySelector('header').getBoundingClientRect()
      // Buttons in view (header, list footer, ...) whose middle the toast covers.
      const covered = [...document.querySelectorAll('button')].filter(b => {
        const r = b.getBoundingClientRect()
        if (!r.width || !r.height || r.bottom <= 0 || r.top >= window.innerHeight) return false
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return toast.contains(hit)
      })
      const style = getComputedStyle(toast)
      const live = [...document.querySelectorAll('[role="status"][aria-live="polite"]')].map(el => el.textContent)
      return {
        belowHeader: rect.top >= header.bottom,
        atBottom: window.innerHeight - rect.bottom < 120,
        covered: covered.map(b => b.getAttribute('aria-label') || b.textContent),
        rootPointerEvents: getComputedStyle(toast.parentElement).pointerEvents,
        color: style.color,
        background: style.backgroundColor,
        live
      }
    })
    assert.ok(state.belowHeader && state.atBottom, 'the toast is near the bottom, clear of the header')
    assert.deepEqual(state.covered, [], 'every button in view can still be clicked')
    assert.equal(state.rootPointerEvents, 'none', 'only the message itself takes clicks')
    assert.equal(state.color, toRgb(uiColors.light.surface), 'toast text')
    assert.equal(state.background, toRgb(uiColors.light.text), 'toast background')
    assert.ok(
      state.live.some(text => /^Logging extended until /.test(text)),
      `the confirmation is in a polite live region (${state.live.join(' | ')})`
    )
    // While the toast shows, the overflow menu opens and its items work.
    await openMenuItem('Appearance…')
    await app.waitForSelector(dialog('Appearance'), { visible: true })
    await app.click(`${dialog('Appearance')} ::-p-aria([name="Close appearance"][role="button"])`)
    await app.waitForSelector(dialog('Appearance'), { hidden: true })
    await app.waitForSelector(TOAST, { hidden: true, timeout: 15000 })
  })

  await t.test('help overlay lists the shortcuts', async () => {
    await app.evaluate(() => document.activeElement && document.activeElement.blur())
    await app.keyboard.press('?')
    const HELP = dialog('Keyboard shortcuts')
    await app.waitForSelector(HELP, { visible: true })
    const text = await app.$eval(HELP, d => d.innerText)
    assert.match(text, /Refresh the list of logs/)
    assert.doesNotMatch(text, /delete all/i)
    await app.keyboard.press('Escape')
    await app.waitForSelector(HELP, { hidden: true })
  })

  await app.evaluate(id => (location.hash = `#/logs/${id}`), log.Id)
  await app.waitForFunction(
    marker => document.querySelector('pre') && document.querySelector('pre').innerText.includes(marker),
    { timeout: 30000 },
    MARKER
  )

  await t.test('log body is visible', async () => {
    const visible = await app.evaluate(marker => {
      const el = [...document.querySelectorAll('pre > div')].find(d => d.innerText.includes(marker))
      const box = el && el.getBoundingClientRect()
      return Boolean(box && box.width > 0 && box.height > 0)
    }, MARKER)
    assert.ok(visible)
  })

  await t.test('log text is shown as text, never parsed as HTML', async () => {
    const result = await app.evaluate(() => ({
      text: document.querySelector('pre').innerText,
      images: document.querySelectorAll('pre img').length,
      xss: window.__xss
    }))
    assert.ok(result.text.includes(XSS), 'markup is shown literally')
    assert.equal(result.images, 0, 'no <img> element was created from log text')
    assert.equal(result.xss, undefined, 'no handler from log text ran')
  })

  await t.test('every log entry is rendered, including the last one', async () => {
    const expected = log.body.match(/^\d\d:\d\d:\d\d\.\d+ \(\d+\)\|/gm).length
    const rendered = await app.evaluate(() => document.querySelectorAll('pre > div').length - 1)
    assert.equal(rendered, expected, 'one line per timestamped entry (plus the header)')
    const lastLine = log.body.trimEnd().split('\n').pop()
    const lastRendered = await app.evaluate(() => [...document.querySelectorAll('pre > div')].pop().innerText.trim())
    assert.equal(lastRendered, lastLine.trim())
  })

  await t.test('find in log counts and highlights matches', async () => {
    const FIND = '::-p-aria([name="Find in log"][role="textbox"])'
    await app.click(FIND)
    await app.type(FIND, MARKER.toLowerCase())
    await app.waitForFunction(() => /^1 of \d+$/.test(document.querySelector('#find-counter').textContent), {
      timeout: 5000
    })
    const total = Number((await app.$eval('#find-counter', el => el.textContent)).split(' of ')[1])
    const marks = await app.$$eval('pre mark', els => els.length)
    assert.equal(marks, total, 'every match is highlighted')
    await app.keyboard.press('Enter')
    assert.match(await app.$eval('#find-counter', el => el.textContent), /^2 of /, 'Enter goes to the next match')
    await app.click(FIND, { clickCount: 3 })
    await app.keyboard.press('Escape')
    await app.waitForFunction(() => document.querySelectorAll('pre mark').length === 0)
  })

  await t.test('errors have a marker, not only a color', async () => {
    const markers = await app.$$eval(
      'pre > div[data-category="error"] [role="img"][aria-label="Error"]',
      els => els.length
    )
    const errorLines = await app.$$eval('pre > div[data-category="error"]', els => els.length)
    assert.ok(errorLines > 0, 'the log has an error line (the caught exception)')
    assert.equal(markers, errorLines, 'each error line has an error marker')
  })

  await t.test('summary shows limits, the exception, SOQL and DML, and jumps to their lines', async () => {
    const activeLine = () =>
      app.evaluate(() => {
        const div = document.querySelector('pre > div.is-active')
        return div ? div.innerText : null
      })
    const summaryRows = () =>
      app.evaluate(() =>
        [...document.querySelectorAll('#log-summary tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ').trim())
      )
    await app.click('::-p-aria([name="Summary"][role="button"])')
    await app.waitForSelector('::-p-aria([name="Log summary"])', { visible: true })

    // Errors first, since the log has one.
    const exception = '::-p-xpath(//*[@id="log-summary"]//li//button[contains(., "System.MathException: Divide by 0")])'
    await app.click(exception)
    await app.waitForFunction(
      () =>
        /EXCEPTION_THROWN\|\[\d+\]\|System\.MathException/.test(
          (document.querySelector('pre > div.is-active') || {}).innerText || ''
        ),
      { timeout: 5000 }
    )

    await app.click('::-p-xpath(//*[@id="log-summary"]//*[@role="tab"][starts-with(., "Limits")])')
    const soqlLimit = (await summaryRows()).find(r => r.startsWith('Number of SOQL queries'))
    assert.match(soqlLimit, /\b4 \/ 100\b/, 'four queries out of 100, as in the log')

    await app.click('::-p-xpath(//*[@id="log-summary"]//*[@role="tab"][starts-with(., "SOQL")])')
    const loop = (await summaryRows()).find(r => r.includes('SELECT Id FROM User LIMIT 1'))
    assert.match(loop, /Possible query in loop/)
    assert.match(loop, / 3 3 /, 'the query ran 3 times and returned 3 rows')
    await app.click('::-p-aria([name="SELECT Id FROM User LIMIT 1"][role="button"])')
    await app.waitForFunction(
      () =>
        /SOQL_EXECUTE_BEGIN.*SELECT Id FROM User LIMIT 1/.test(
          (document.querySelector('pre > div.is-active') || {}).innerText || ''
        ),
      { timeout: 5000 }
    )
    const first = await activeLine()
    await app.click('::-p-aria([name="SELECT Id FROM User LIMIT 1"][role="button"])')
    await app.waitForFunction(
      before => {
        const text = (document.querySelector('pre > div.is-active') || {}).innerText || ''
        return text !== before && /SELECT Id FROM User LIMIT 1/.test(text)
      },
      { timeout: 5000 },
      first
    )

    if (MOCK) {
      await app.click('::-p-xpath(//*[@id="log-summary"]//*[@role="tab"][starts-with(., "DML")])')
      const dml = await summaryRows()
      assert.equal(dml.length, 1)
      assert.match(dml[0], /^Insert Account 1 2 /, 'one insert of 2 accounts')
    }

    await app.click('::-p-aria([name="Hide summary"][role="button"])')
    await app.waitForSelector('#log-summary', { hidden: true })
  })

  // The mock org seeds a failed log of another user (a LimitException).
  await t.test('a failed log opens with its summary shown', { skip: !MOCK && 'mock org only' }, async () => {
    const [failed] = await sf.query("SELECT Id FROM ApexLog WHERE Status != 'Success' LIMIT 1")
    assert.ok(failed, 'the mock org has a failed log')
    await app.evaluate(id => (location.hash = `#/logs/${id}`), failed.Id)
    await app.waitForSelector('::-p-aria([name="Log summary"])', { visible: true, timeout: 30000 })
    const selected = await app.$eval('#log-summary [role="tab"][aria-selected="true"]', el => el.textContent)
    assert.match(selected, /^Errors/, 'the Errors tab is selected')
    await app.click('::-p-aria([name="Hide summary"][role="button"])')
    await app.waitForSelector('#log-summary', { hidden: true })
    // Back to the successful log: the summary stays as the user left it.
    await app.evaluate(id => (location.hash = `#/logs/${id}`), log.Id)
    await app.waitForFunction(
      marker => document.querySelector('pre') && document.querySelector('pre').innerText.includes(marker),
      { timeout: 30000 },
      MARKER
    )
    assert.equal(await app.$('#log-summary'), null, 'the summary is still hidden')
  })

  // The call tree and the timeline (core/log/execution-tree.ts).
  // Each row's accessible name comes from its text (with the column names
  // for screen readers), so it is read from the accessibility tree.
  const nameOf = async el => {
    const node = await app.accessibility.snapshot({ root: el, interestingOnly: false })
    return ((node && node.name) || '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim()
  }
  const treeItems = async () => {
    const items = []
    for (const el of await app.$$('[role="treeitem"]')) {
      const { level, line } = await el.evaluate(el => ({
        level: Number(el.getAttribute('aria-level')),
        line: Number(el.dataset.line)
      }))
      items.push({ label: await nameOf(el), level, line })
    }
    return items
  }
  const activeLogLine = line =>
    app.waitForFunction(
      line => {
        const row = document.querySelector('pre > div.is-active')
        return row && row.dataset.line === String(line) && row.getBoundingClientRect().height > 0
      },
      { timeout: 5000 },
      line
    )
  // The anonymous code unit's line, from the call tree.
  let unitLine = -1

  await t.test('call tree nests the code unit, counts its SOQL, and Enter goes to its line', async () => {
    await app.click('::-p-aria([name="Call tree"][role="tab"])')
    await app.waitForSelector('::-p-aria([name="Call tree"][role="tree"])', { visible: true, timeout: 10000 })
    const all = await treeItems()
    const unit = all.find(i => i.label.startsWith('Code unit execute_anonymous_apex'))
    assert.ok(unit, `the anonymous code unit is listed (${all.map(i => i.label).join(' | ')})`)
    unitLine = unit.line
    assert.equal(unit.level, 2, 'inside the execution')
    const soql = (log.body.match(/\|SOQL_EXECUTE_BEGIN\|/g) || []).length
    assert.match(unit.label, new RegExp(`, ${soql} SOQL,`), 'counts the queries it ran')
    assert.match(unit.label, /total [\d.]+ (ns|µs|ms|s), self [\d.]+ (ns|µs|ms|s)/)
    if (MOCK) {
      // Real-org logs list methods only at the Fine Apex Code level.
      const method = all.find(i => i.label.startsWith('Method MockSetup.run()'))
      assert.ok(method, 'the method the code unit called is listed')
      assert.equal(method.level, 3, 'nested in the code unit')
    }
    const shownLines = await app.$$eval(
      'pre > div',
      els => els.filter(el => el.getBoundingClientRect().height > 0).length
    )
    assert.equal(shownLines, 0, 'the log body is hidden while the tree is shown')

    // Keyboard: Home, Down to the code unit, Left closes it, Right opens it,
    // Enter goes to its line in the log.
    await app.focus('[role="tree"]')
    await app.keyboard.press('Home')
    await app.keyboard.press('ArrowDown')
    const active = async () => {
      const el = await app
        .$('[role="tree"]')
        .then(tree => tree.evaluateHandle(tree => document.getElementById(tree.getAttribute('aria-activedescendant'))))
      return { label: await nameOf(el), expanded: await el.evaluate(el => el.getAttribute('aria-expanded')) }
    }
    assert.match((await active()).label, /^Code unit execute_anonymous_apex/)
    await app.keyboard.press('ArrowLeft')
    assert.equal((await active()).expanded, 'false', 'Left closes the unit')
    await app.keyboard.press('ArrowRight')
    assert.equal((await active()).expanded, 'true', 'Right opens it again')
    await app.keyboard.press('Enter')
    await activeLogLine(unit.line)
    await app.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Log body', {
      timeout: 2000
    })
    assert.equal(await app.$eval('::-p-aria([name="Log"][role="tab"])', el => el.getAttribute('aria-selected')), 'true')
  })

  await t.test('timeline draws the units, zooms, and a click on a bar goes to its line', async () => {
    assert.ok(unitLine > 0, 'the call tree check found the code unit')
    await app.click('::-p-aria([name="Timeline"][role="tab"])')
    const GROUP = '::-p-aria([name="Timeline"][role="group"])'
    await app.waitForSelector(GROUP, { visible: true, timeout: 10000 })
    await app.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="timeline-canvas"]')
      return canvas && canvas.width > 0 && canvas.height > 0
    })
    const windowText = () => app.$eval('[data-testid="timeline-window"]', el => el.textContent)
    assert.match(await windowText(), /^Whole run: /)
    await app.click('::-p-aria([name="Zoom in"][role="button"])')
    await app.waitForFunction(() => / of /.test(document.querySelector('[data-testid="timeline-window"]').textContent))
    await app.click('::-p-aria([name="Show the whole run"][role="button"])')
    await app.waitForFunction(() =>
      /^Whole run/.test(document.querySelector('[data-testid="timeline-window"]').textContent)
    )
    // The keys the ? overlay lists: + zooms in, 0 shows the whole run.
    await app.focus('[role="group"][aria-label="Timeline"]')
    await app.keyboard.type('+')
    await app.waitForFunction(() => / of /.test(document.querySelector('[data-testid="timeline-window"]').textContent))
    await app.keyboard.press('0')
    await app.waitForFunction(() =>
      /^Whole run/.test(document.querySelector('[data-testid="timeline-window"]').textContent)
    )
    // Level 2 (below the 22 px axis, 20 px per level) is the code unit,
    // which spans nearly the whole run.
    const box = await (await app.$(GROUP)).boundingBox()
    await app.mouse.click(box.x + box.width / 2, box.y + 22 + 20 + 10)
    await activeLogLine(unitLine)
  })

  // The extension's debug level is DEBUG for every category, and
  // Salesforce writes method calls from Apex Code FINE up, so this log has a
  // notice above its tree and timeline. "Log methods…" opens the Trace flags
  // dialog with the "Apex FINEST" custom levels; nothing is started.
  await t.test('call tree says methods are missing and offers to log them', async () => {
    const TRACE = '::-p-aria([name="Trace flags"][role="dialog"])'
    await app.click('::-p-aria([name="Call tree"][role="tab"])')
    // Each shown panel keeps its own notice: look in the one in view.
    const notice = '#log-view-panel-tree [data-testid="methods-notice"]'
    await app.waitForSelector(notice, { visible: true, timeout: 10000 })
    const text = await app.$eval(notice, el => el.textContent)
    assert.match(text, /No method calls in this log: its Apex Code level is DEBUG/, 'the notice names the level')
    const logMethods = `${notice} ::-p-aria([name="Log methods…"][role="button"])`
    await app.click(logMethods)
    await app.waitForSelector(TRACE, { visible: true })
    assert.equal(
      await app.$eval(`${TRACE} ::-p-aria([name="Debug level"][role="combobox"])`, el => el.textContent),
      'Custom levels…',
      'opens with custom levels'
    )
    assert.equal(
      await app.$eval(`${TRACE} ::-p-aria([name="Apex code"][role="combobox"])`, el => el.textContent),
      'FINEST',
      'Apex code at FINEST'
    )
    await app.click(`${TRACE} ::-p-aria([name="Close"][role="button"])`)
    await app.waitForSelector(TRACE, { hidden: true })
    await app.waitForFunction(
      sel => document.activeElement === document.querySelector(sel),
      { timeout: 3000 },
      logMethods.replace(/ ::-p-aria.*$/, ' button')
    )
    await app.click('::-p-aria([name="Timeline"][role="tab"])')
    await app.waitForSelector('#log-view-panel-timeline [data-testid="methods-notice"]', { visible: true })
    await app.click('::-p-aria([name="Log"][role="tab"])')
    await app.waitForSelector('pre > div[data-index="0"]', { visible: true, timeout: 5000 })
  })

  await t.test('indent toggle beautifies a debugged SObject', async () => {
    // "<marker> users (User:{Id=…, Name=…})" is pretty-printed with js-beautify.
    const line = () =>
      app.evaluate(marker => {
        const div = [...document.querySelectorAll('pre > div')].find(
          d => /users ?\(User/.test(d.innerText) && d.innerText.includes(marker)
        )
        return div ? div.innerText : null
      }, MARKER)
    const before = await line()
    assert.ok(before && !before.trim().includes('\n'), 'collapsed: one line')
    assert.match(before, /Name=/, 'text after the user id is kept')
    await app.evaluate(marker => {
      const div = [...document.querySelectorAll('pre > div')].find(
        d => /users ?\(User/.test(d.innerText) && d.innerText.includes(marker)
      )
      div.querySelector('button[aria-label="Expand value"]').click()
    }, MARKER)
    await app.waitForFunction(
      marker => {
        const div = [...document.querySelectorAll('pre > div')].find(
          d => /users ?\(User/.test(d.innerText) && d.innerText.includes(marker)
        )
        return div && div.innerText.trim().split('\n').length > 2
      },
      { timeout: 5000, polling: 100 },
      MARKER
    )
    assert.match(await line(), /\n\s+Id:[^\n]*\n\s+Name:/, 'expanded: one field per indented line')
  })

  const APPEARANCE = dialog('Appearance')
  const openAppearance = async () => {
    await openMenuItem('Appearance…')
    await app.waitForSelector(APPEARANCE, { visible: true })
  }
  const closeAppearance = async () => {
    await app.click(`${APPEARANCE} ::-p-aria([name="Close appearance"][role="button"])`)
    await app.waitForSelector(APPEARANCE, { hidden: true })
  }
  // Sets a React-controlled input's value the way a user edit would.
  const setInput = async (selector, value) =>
    app.evaluate(
      (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      await app.waitForSelector(selector),
      value
    )
  const renderedStyles = () =>
    app.evaluate(() => {
      const pre = document.querySelector('pre')
      return {
        background: getComputedStyle(pre.parentElement).backgroundColor,
        fontSize: getComputedStyle(pre).fontSize,
        whiteSpace: getComputedStyle(pre.querySelector('div')).whiteSpace,
        elements: [...pre.children].slice(1).map(div => ({
          text: div.innerText.slice(0, 80),
          color: getComputedStyle(div).color,
          'font-weight': getComputedStyle(div).fontWeight,
          'font-style': getComputedStyle(div).fontStyle
        }))
      }
    })
  // Category the app assigns to a log line (eventCategory, as in log-lines.ts).
  const categoryOf = text => eventCategory((text.match(/\|([A-Z_]+)/) || [])[1] || '')
  const checkTheme = async theme => {
    const styles = await renderedStyles()
    assert.equal(styles.background, toRgb(theme.background), 'background color')
    const failures = []
    for (const el of styles.elements) {
      const category = categoryOf(el.text)
      const style = theme.categories[category]
      if (!style) {
        failures.push(`theme has no style for category "${category}" (${el.text})`)
        continue
      }
      for (const [prop, value] of Object.entries(computedCategoryStyle(style))) {
        if (!el[prop].startsWith(value))
          failures.push(`${category} ${prop}: expected ${value}, got ${el[prop]} (${el.text})`)
      }
    }
    assert.deepEqual([...new Set(failures)], [])
  }

  await t.test('log colors menu opens on click', async () => {
    await openAppearance()
    await app.click(combobox('Log colors'))
    await delay(500)
    const opened = (await app.$$('li[role="option"]')).length > 0
    if (opened) {
      await app.keyboard.press('Escape')
      await app.waitForSelector('[role="listbox"]', { hidden: true })
    }
    await closeAppearance()
    assert.ok(opened, 'clicking the Log colors select shows the palettes')
  })

  for (const theme of Object.values(logThemes)) {
    await t.test(`palette "${theme.name}" applies to every event type`, async () => {
      await openAppearance()
      await chooseOption('Log colors', theme.label)
      await closeAppearance()
      await checkTheme(theme)
    })
  }

  await t.test('custom color applies', async () => {
    await openAppearance()
    await setInput('::-p-aria([name="Debug output"][role="textbox"])', '#123456')
    await closeAppearance()
    const { elements } = await renderedStyles()
    const debugLine = elements.find(e => e.text.includes('|USER_DEBUG|'))
    assert.equal(debugLine.color, toRgb('#123456'))
    await openAppearance()
    await app.click(`${APPEARANCE} ::-p-aria([name="Reset to palette"][role="button"])`)
    await closeAppearance()
  })

  await t.test('font size applies', async () => {
    await openAppearance()
    await setInput('::-p-aria([name="Font size"][role="spinbutton"])', '15')
    await closeAppearance()
    assert.equal((await renderedStyles()).fontSize, '15px')
  })

  await t.test('text wrap toggle applies', async () => {
    const before = (await renderedStyles()).whiteSpace
    await openAppearance()
    await app.click('::-p-aria(Wrap long lines)')
    await closeAppearance()
    const afterToggle = (await renderedStyles()).whiteSpace
    assert.notEqual(afterToggle, before, `white-space stays "${before}" after toggling wrapping`)
  })

  await t.test('dark mode renders the app and the log dark', async () => {
    await openAppearance()
    await chooseOption('Log colors', 'Match app (Light or Dark)')
    await app.click(`${APPEARANCE} ::-p-aria([name="Dark"][role="button"])`)
    await closeAppearance()
    const colors = await app.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      header: getComputedStyle(document.querySelector('header')).backgroundColor,
      headerText: getComputedStyle(document.querySelector('header h1')).color,
      mode: document.documentElement.dataset.apexdbgColorMode
    }))
    assert.equal(colors.mode, 'dark')
    assert.equal(colors.body, toRgb(uiColors.dark.bg), 'page background')
    assert.equal(colors.header, toRgb(uiColors.dark.surface), 'header background')
    assert.equal(colors.headerText, toRgb(uiColors.dark.text), 'header text')
    await checkTheme(logThemes.dark)
    // Following the OS again: light here.
    await openAppearance()
    await app.click(`${APPEARANCE} ::-p-aria([name="System"][role="button"])`)
    await closeAppearance()
    await checkTheme(logThemes.light)
  })

  await t.test('a long log renders the lines in view, and every line when scrolled through', async () => {
    const entries = longLog.body.match(/^\d\d:\d\d:\d\d\.\d+ \(\d+\)\|[^\n]*/gm).map(e => e.trim())
    assert.ok(entries.length > 2000, `the long log has ${entries.length} entries`)
    await app.evaluate(id => (location.hash = `#/logs/${id}`), longLog.Id)
    await app.waitForFunction(
      marker => [...document.querySelectorAll('pre > div')].some(d => d.innerText.includes(marker)),
      { timeout: 30000 },
      LONG_MARKER
    )
    const rendered = await app.evaluate(() => document.querySelectorAll('pre > div').length)
    assert.ok(rendered < 200, `only the lines in view are in the page (${rendered} of ${entries.length + 1})`)
    // Scroll through the log a screen at a time; each line is in the page
    // when it is in view. Lines carry their index (0 is the header).
    const seen = await app.evaluate(async () => {
      const pre = document.querySelector('pre')
      const scroller = pre.parentElement
      const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const seen = {}
      scroller.scrollTop = 0
      await frame()
      for (let step = 0; step < 5000; step++) {
        for (const div of pre.children) seen[div.dataset.index] = div.innerText.split('\n')[0].trim()
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) break
        scroller.scrollTop += scroller.clientHeight
        await frame()
      }
      return seen
    })
    assert.equal(Object.keys(seen).length, entries.length + 1, 'every line was rendered')
    const wrong = entries.flatMap((entry, i) => (seen[i + 1] === entry ? [] : [`${i + 1}: ${seen[i + 1]}`]))
    assert.deepEqual(wrong.slice(0, 5), [], 'each line shows its entry, in order')
    const lastRendered = await app.evaluate(() => [...document.querySelectorAll('pre > div')].pop().innerText.trim())
    assert.equal(lastRendered, longLog.body.trimEnd().split('\n').pop().trim(), 'the last line is shown at the end')
  })

  await t.test("Shift+W again focuses the org's open app instead of opening another", async () => {
    const appPages = async () => (await ext.browser.pages()).filter(p => p.url().includes('/html/app.html'))
    await sfPage.bringToFront()
    await sfPage.evaluate(() => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur()
      window.focus()
    })
    const pressedAt = Date.now()
    await sfPage.keyboard.down('Shift')
    await sfPage.keyboard.press('KeyW')
    await sfPage.keyboard.up('Shift')
    await app.waitForFunction(() => document.visibilityState === 'visible', { timeout: 10000 })
    const asked = (await workerMessages()).filter(m => m.command === 'focusAppTab' && m.time >= pressedAt)
    assert.ok(asked.length > 0, 'the shortcut asked the service worker to focus the app')
    await delay(1000)
    assert.equal((await appPages()).length, 1, 'no second app tab was opened')
  })

  const unexpected = errors.filter(e => !/Failed to fetch/.test(e))
  if (unexpected.length) t.diagnostic(`page errors: ${unexpected.join(' | ')}`)
})

test('sessions are only handed out for org hosts', async () => {
  // Content scripts also run on public Salesforce Sites (*.force.com,
  // *.my.site.com). They must not get the saved token or an org cookie.
  await ext.background.evaluate(() => chrome.storage.local.set({ token: 'saved-token' }))
  try {
    const lookup = url => ext.background.evaluate(url => getSessionForUrl(url), url)
    for (const url of ['https://someone.force.com/s/', 'https://someone.my.site.com/', 'https://evil.example.com/']) {
      assert.equal((await lookup(url)).token, undefined, url)
    }
    const org = await lookup(`${session.instance}/setup/ui/listApexTraces.apexp`)
    assert.ok(org.token && org.token !== 'saved-token', 'org host gets its sid cookie')
    assert.equal(org.host, new URL(session.instance).hostname)
  } finally {
    await ext.background.evaluate(() => chrome.storage.local.remove('token'))
  }
})

test('Lightning Experience: Shift+W opens the app with the org session', async t => {
  // Lightning runs on other domains than the API: Home on
  // *.lightning.force.com, Setup on *.my.salesforce-setup.com. Their sid
  // cookies aren't accepted by the API, so the extension must use the org's
  // my.salesforce.com session. Switch the user to Lightning for this test only
  // (Settings > Switch to Lightning Experience), then restore the preference.
  const wasLightning = await sf.lightningPreferred()
  await sf.setLightningPreferred(true)
  const page = await ext.browser.newPage()
  const consoleLog = []
  page.on('console', m => consoleLog.push(`page ${m.type()}: ${m.text()}`))
  page.on('pageerror', e => consoleLog.push(`page error: ${e.message}`))
  try {
    for (const [label, path, domain] of [
      ['Home', '/lightning/page/home', '.lightning.force.com'],
      ['Setup', '/lightning/setup/ApexDebugLogs/home', '.my.salesforce-setup.com']
    ]) {
      await t.test(`from Lightning ${label} (${domain})`, async () => {
        // An open app tab would just be focused; close it so Shift+W opens one.
        for (const p of await ext.browser.pages()) {
          if (p.url().includes('/html/app.html')) await p.close()
        }
        // The redirect to Lightning can take over a minute; wait for the
        // domain and Lightning's shell, and navigate once more if needed.
        await gotoLightning(page, frontdoorUrl(session, path), domain, {
          log: line => consoleLog.push(`lightning: ${line}`)
        })
        const app = await openAppWithShiftW(page, consoleLog, `lightning-${label.toLowerCase()}`)
        const appUrl = new URL(app.url())
        assert.equal(
          appUrl.searchParams.get('host'),
          new URL(session.instance).hostname,
          'app talks to the my.salesforce.com host'
        )
        assert.ok(appUrl.searchParams.get('sid'), 'app gets a session id')
        await app.waitForSelector(`[role="grid"] [data-log-id="${log.Id}"]`, { timeout: 30000 })
      })
    }
  } finally {
    await page.close().catch(() => {})
    await sf.setLightningPreferred(wasLightning)
  }
})

test('pages without readable ids', async t => {
  // Salesforce's disco cookie, which carries the user and org ids, isn't
  // readable on every page; Shift+W then opens the app with uid=undefined.
  await t.test('the app finds the user itself and shows logging as active', async () => {
    const page = await ext.browser.newPage()
    const errors = collectPageErrors(page)
    try {
      const host = new URL(session.instance).hostname
      await page.goto(
        `chrome-extension://${ext.extensionId}/html/app.html?oid=undefined&uid=undefined&sid=${encodeURIComponent(session.sessionId)}&host=${host}`
      )
      await page.waitForSelector('[role="grid"] [data-log-id]', { timeout: 30000 })
      // The flow keeps a trace flag on the user: the header shows "Logging on"
      // (instead of "Logging off") once the user id is known.
      await page.waitForFunction(() => /Logging on/.test(document.body.innerText), {
        timeout: 30000
      })
      assert.deepEqual(
        errors.filter(e => /Salesforce id/.test(e)),
        []
      )
    } finally {
      await page.close()
    }
  })

  await t.test('the "all classes" list page loads without script errors', async () => {
    const page = await ext.browser.newPage()
    const errors = collectPageErrors(page)
    try {
      await page.goto(frontdoorUrl(session, '/01p?all_classes_page%3AtheTemplate%3AclassList%3Arowsperpage=3500'), {
        waitUntil: 'networkidle2',
        timeout: 60000
      })
      await new Promise(r => setTimeout(r, 2000))
      assert.deepEqual(errors, [])
    } finally {
      await page.close()
    }
  })
})

// Creates and deletes trace flags for other users, Automated Process and an
// Apex class: on the mock org only, so a run never changes how a real org's
// other users or classes are logged.
test('trace flags: debug level, duration and target', { skip: !MOCK && 'mock org only' }, async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.setViewport({ width: 1400, height: 1000 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  const host = new URL(session.instance).hostname
  await page.goto(
    `chrome-extension://${ext.extensionId}/html/app.html?oid=${session.orgId}&uid=${session.userId}&sid=${encodeURIComponent(session.sessionId)}&host=${host}`
  )
  await page.bringToFront()
  const DIALOG = '::-p-aria([name="Trace flags"][role="dialog"])'
  const combobox = label => `${DIALOG} ::-p-aria([name="${label}"][role="combobox"])`
  const button = name => `${DIALOG} ::-p-aria([name="${name}"][role="button"])`
  const chooseOption = async (label, text) => {
    await page.click(combobox(label))
    const option = `::-p-xpath(//li[@role="option" and normalize-space()="${text}"])`
    await page.waitForSelector(option, { visible: true })
    await page.click(option)
    await page.waitForSelector('[role="listbox"]', { hidden: true })
    await delay(200)
  }
  // An Autocomplete: type, then pick the option whose primary text is `name`.
  const pick = async (label, term, name) => {
    await page.click(combobox(label))
    await page.type(combobox(label), term)
    const option = `::-p-xpath(//li[@role="option" and .//*[normalize-space()="${name}"]])`
    await page.waitForSelector(option, { visible: true, timeout: 10000 })
    await page.click(option)
    await delay(200)
  }
  const flagRows = () => page.$$eval('[role="dialog"] li[data-flag-id]', rows => rows.map(r => r.innerText))
  const waitForRow = (text, present = true) =>
    page.waitForFunction(
      (text, present) =>
        [...document.querySelectorAll('[role="dialog"] li[data-flag-id]')].some(r => r.innerText.includes(text)) ===
        present,
      { timeout: 15000 },
      text,
      present
    )
  const activeFlags = entityId =>
    sf.query(
      `SELECT Id, StartDate, ExpirationDate, LogType, DebugLevel.DeveloperName FROM TraceFlag ` +
        `WHERE TracedEntityId = '${entityId}' AND ExpirationDate > ${new Date().toISOString()}`
    )
  const allFlags = async () => (await sf.query('SELECT Id FROM TraceFlag')).length

  try {
    await t.test('the dialog opens from the logging menu and starts nothing by itself', async () => {
      const before = await allFlags()
      const status = '::-p-xpath(//button[starts-with(normalize-space(), "Logging on")])'
      await page.waitForSelector(status, { timeout: 30000 })
      await page.click(status)
      const item = '::-p-xpath(//li[@role="menuitem" and .//*[normalize-space()="Trace flags…"]])'
      await page.waitForSelector(item, { visible: true })
      await page.click(item)
      await page.waitForSelector(DIALOG, { visible: true })
      await waitForRow('You (Mock Developer)')
      assert.ok(await page.$(button('Stop tracing You (Mock Developer)')), 'my flag has a named Stop button')
      const row = (await flagRows()).find(r => r.includes('You (Mock Developer)'))
      assert.match(row, /\d+ (h|min)( \d+ min)? left/, 'the flag shows the time left')
      assert.match(row, /until (tomorrow |[A-Z][a-z]{2} \d{1,2}, )?\d{1,2}:\d{2}/, 'and when it ends')
      await delay(500)
      assert.equal(await allFlags(), before, 'opening the dialog creates no trace flag')
    })

    await t.test('a class with custom levels for 1 hour, then stopped', async () => {
      const classId = '01pMK0000000002AAA'
      await chooseOption('Trace', 'An Apex class or trigger')
      await pick('Apex class or trigger', 'invoice', 'InvoiceBatch')
      await chooseOption('Debug level', 'Custom levels…')
      await page.click(`${DIALOG} ::-p-aria([name="Apex FINEST"][role="button"])`)
      const apexLevel = await page.$eval(combobox('Apex code'), el => el.textContent)
      assert.equal(apexLevel, 'FINEST', 'the preset sets Apex code to FINEST')
      await chooseOption('Database', 'NONE')
      await chooseOption('Duration', '1 hour')
      await page.click(button('Start tracing'))
      await waitForRow('InvoiceBatch · Class')
      const [flag] = await activeFlags(classId)
      assert.equal(flag.LogType, 'CLASS_TRACING')
      assert.equal(flag.DebugLevel.DeveloperName, 'ApexDbgrCustom')
      const span = new Date(flag.ExpirationDate) - new Date(flag.StartDate)
      assert.ok(Math.abs(span - 3600_000) < 5000, `1 hour (was ${span} ms)`)
      const [level] = await sf.query(
        "SELECT ApexCode, Database, System FROM DebugLevel WHERE DeveloperName = 'ApexDbgrCustom'"
      )
      const { ApexCode, Database, System } = level
      assert.deepEqual(
        { ApexCode, Database, System },
        {
          ApexCode: 'FINEST',
          Database: 'NONE',
          System: 'DEBUG'
        }
      )
      await page.click(button('Stop tracing InvoiceBatch'))
      await waitForRow('InvoiceBatch', false)
      assert.deepEqual(await activeFlags(classId), [], 'Stop deletes the flag')
    })

    await t.test('another user found by name, and Automated Process', async () => {
      const other = '005MK0000000002AAA'
      await chooseOption('Trace', 'Another user')
      await pick('User', 'other', 'Other Developer')
      await chooseOption('Debug level', 'ApexDbgrExtension (extension default)')
      await chooseOption('Duration', '30 minutes')
      await page.click(button('Start tracing'))
      await waitForRow('Other Developer · User')
      const [flag] = await activeFlags(other)
      assert.equal(flag.LogType, 'USER_DEBUG')
      assert.equal(flag.DebugLevel.DeveloperName, 'ApexDbgrExtension')
      await chooseOption('Trace', 'Automated Process')
      await page.click(button('Start tracing'))
      await waitForRow('Automated Process · User')
      for (const name of ['Other Developer', 'Automated Process']) {
        await page.click(button(`Stop tracing ${name}`))
        await waitForRow(name, false)
      }
      assert.deepEqual(await activeFlags(other), [])
      assert.ok(
        (await flagRows()).some(r => r.includes('You (Mock Developer)')),
        'my own flag is untouched'
      )
      await page.click(button('Close'))
      await page.waitForSelector(DIALOG, { hidden: true })
    })
  } finally {
    if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
    await page.close()
  }
})

test('classic log page toolbar', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.setViewport({ width: 1200, height: 800 })
  await page.goto(frontdoorUrl(session, classicUrl(log.Id)), { waitUntil: 'networkidle2' })
  await page.waitForSelector('#apexdbgToolbar', { timeout: 20000 })

  await t.test('every control has a label', async () => {
    const unlabeled = await page.$$eval('#apexdbgToolbar select, #apexdbgToolbar input', els =>
      els.filter(el => !(el.labels && el.labels.length && el.labels[0].textContent.trim())).map(el => el.id)
    )
    assert.deepEqual(unlabeled, [])
  })

  await t.test('the toolbar stays in view while the log scrolls', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await delay(200)
    const top = await page.$eval('#apexdbgToolbar', el => el.getBoundingClientRect().top)
    assert.ok(top >= -1 && top < 5, `toolbar top at ${top}px`)
    await page.evaluate(() => window.scrollTo(0, 0))
  })

  await t.test('timestamps toggle without reloading the page', async () => {
    await page.evaluate(() => (window.__noReload = true))
    const marker = () =>
      page.$$eval(
        '#debugText .debug',
        (els, m) => (els.find(e => e.textContent.includes(m)) || {}).textContent || '',
        MARKER
      )
    assert.ok(!/^\d\d:\d\d:\d\d/.test(await marker()), 'no timestamp by default')
    await page.click('#showTimestamps')
    await page.waitForFunction(() => document.querySelector('#showTimestamps').checked)
    assert.match(await marker(), /^\d\d:\d\d:\d\d/, 'timestamps shown')
    assert.equal(await page.evaluate(() => window.__noReload), true, 'same page')
    await page.click('#showTimestamps')
  })

  await t.test('expand buttons say what they do', async () => {
    const button = await page.waitForSelector('#debugText .expandUserDebugBtn', { timeout: 10000 })
    const before = await button.evaluate(b => [b.getAttribute('aria-label'), b.getAttribute('aria-expanded')])
    assert.deepEqual(before, ['Expand value', 'false'])
    await button.click()
    const after = await button.evaluate(b => [b.getAttribute('aria-label'), b.getAttribute('aria-expanded')])
    assert.deepEqual(after, ['Collapse value', 'true'])
  })

  await t.test('"Match color mode" follows dark mode', async () => {
    await page.select('#styleSelection', 'auto')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.waitForFunction(() => document.querySelector('#debugText').className === 'dark')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await page.waitForFunction(() => document.querySelector('#debugText').className === 'light')
  })

  if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
  await page.close()
})

test('classic log list: delete asks with scope and count; search reports results', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  // Never confirm anything the page might ask.
  page.on('dialog', d => d.dismiss().catch(() => {}))
  await page.goto(frontdoorUrl(session, '/setup/ui/listApexTraces.apexp'), { waitUntil: 'networkidle2' })
  await page.waitForSelector('#real_delete_all', { timeout: 30000 })

  await t.test('no single-key delete: "a" opens nothing', async () => {
    await page.evaluate(() => document.activeElement && document.activeElement.blur())
    await page.keyboard.press('KeyA')
    await delay(300)
    assert.equal(await page.$('#apexdbgDeleteDialog'), null)
  })

  await t.test('the dialog defaults to my logs, shows counts, and Cancel deletes nothing', async () => {
    const before = (await sf.query('SELECT Id FROM ApexLog')).length
    await page.click('#real_delete_all')
    await page.waitForFunction(
      () => /Only my logs \(\d[\d,]*\)/.test((document.querySelector('#apexdbgDeleteDialog') || {}).innerText || ''),
      { timeout: 30000 }
    )
    const state = await page.$eval('#apexdbgDeleteDialog', d => ({
      open: d.open,
      mine: d.querySelector('#apexdbgDeleteMine').checked,
      confirm: [...d.querySelectorAll('button')].map(b => b.textContent).find(t => /^Delete/.test(t))
    }))
    assert.equal(state.open, true)
    assert.equal(state.mine, true, 'only my logs by default')
    assert.match(state.confirm, /^Delete [\d,]+ logs?$/)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('#apexdbgDeleteDialog'))
    assert.equal((await sf.query('SELECT Id FROM ApexLog')).length, before, 'nothing deleted')
  })

  await t.test('search says how many logs contain the text', async () => {
    await page.$eval(
      '#FilterByText',
      (el, m) => {
        el.value = m
        el.form.requestSubmit()
      },
      MARKER
    )
    await page.waitForFunction(() => /contain/.test(document.querySelector('#apexdbgSearchStatus').textContent), {
      timeout: 60000
    })
    const status = await page.$eval('#apexdbgSearchStatus', el => el.textContent)
    assert.match(status, /^\d+ of \d+ logs contain/)
    assert.ok((await page.$$('tr.apexdbg-match')).length >= 1, 'matching rows are marked')
  })

  if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
  await page.close()
})

test('options page', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.goto(`chrome-extension://${ext.extensionId}/html/options.html`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('::-p-aria(Key for Debug Logs)', { timeout: 10000 })
  const setKey = async (label, key) => {
    const input = await page.$(`::-p-aria(${label})`)
    await input.click({ clickCount: 3 })
    await page.keyboard.type(key)
  }
  const stored = () => ext.background.evaluate(() => chrome.storage.sync.get('pageShortcuts'))
  const debugLogsKey = async () => {
    const { pageShortcuts } = await stored()
    const shortcut = pageShortcuts && pageShortcuts.shortcuts.find(s => s.id === 'debug-logs')
    return shortcut && shortcut.key
  }

  await t.test('a key used twice is reported and not saved', async () => {
    await setKey('Key for Debug Logs', 'u') // Manage Users is on U
    await page.waitForSelector('::-p-text(is also used by)')
    await page.click('::-p-xpath(//button[normalize-space()="Save shortcuts"])')
    await page.waitForSelector('::-p-text(needs a fix before saving)')
    assert.notEqual(await debugLogsKey(), 'u')
  })

  await t.test('a valid change is saved, with a confirmation', async () => {
    await setKey('Key for Debug Logs', 'g')
    await page.click('::-p-xpath(//button[normalize-space()="Save shortcuts"])')
    await page.waitForSelector('::-p-text(Shortcuts saved)')
    assert.equal(await debugLogsKey(), 'g')
  })

  await t.test('restore defaults asks first, and can be undone', async () => {
    await page.click('::-p-xpath(//button[normalize-space()="Restore defaults…"])')
    await page.waitForSelector('::-p-text(Restore the default shortcuts?)')
    await page.keyboard.press('Escape')
    await delay(500)
    assert.equal(await debugLogsKey(), 'g', 'Escape keeps the shortcuts')
    await page.click('::-p-xpath(//button[normalize-space()="Restore defaults…"])')
    await page.waitForSelector('::-p-text(Restore the default shortcuts?)')
    await page.click('::-p-xpath(//div[@role="dialog"]//button[normalize-space()="Restore defaults"])')
    await page.waitForSelector('::-p-text(Default shortcuts restored)')
    // The confirmation's backdrop fades out first.
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    assert.equal(await debugLogsKey(), 'd')
    await page.click('::-p-xpath(//button[normalize-space()="Undo"])')
    await page.waitForSelector('::-p-text(Your shortcuts are back)')
    assert.equal(await debugLogsKey(), 'g')
    // Leave the defaults for the other tests.
    await ext.background.evaluate(() => chrome.storage.sync.remove('pageShortcuts'))
  })

  await t.test('color mode is shared with the classic pages', async () => {
    await page.click('::-p-xpath(//button[normalize-space()="Dark"])')
    await page.waitForFunction(() => document.documentElement.dataset.apexdbgColorMode === 'dark')
    const { appearance } = await ext.background.evaluate(() => chrome.storage.local.get('appearance'))
    assert.deepEqual(appearance, { colorMode: 'dark' })
    await page.click('::-p-xpath(//button[normalize-space()="System"])')
  })

  if (errors.length) t.diagnostic(`page errors: ${errors.join(' | ')}`)
  await page.close()
})

// Uses the mock org's record page, whose Edit and Save buttons only record the
// click; on a real org's page Save would really save.
test(
  'page shortcuts: Save needs Ctrl/Cmd, and shortcuts can be turned off',
  { skip: !MOCK && 'mock org only' },
  async () => {
    const page = await ext.browser.newPage()
    const path = '/001MK0000000001AAA'
    try {
      const since = Date.now()
      await page.goto(frontdoorUrl(session, path), { waitUntil: 'networkidle2' })
      while (!(await workerMessages()).some(m => m.command === 'getShortcuts' && m.path === path && m.time >= since)) {
        await delay(200)
      }
      await delay(300)
      const clicked = () => page.evaluate(() => document.body.dataset.clicked || null)
      const modS = async () => {
        const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
        await page.keyboard.down(mod)
        await page.keyboard.press('KeyS')
        await page.keyboard.up(mod)
      }
      await page.evaluate(() => document.activeElement && document.activeElement.blur())
      await page.keyboard.press('KeyS')
      await delay(200)
      assert.equal(await clicked(), null, 'a bare s saves nothing')
      // In a field too: Ctrl/Cmd+S never types.
      await page.focus('#accountName')
      await modS()
      await page.waitForFunction(() => document.body.dataset.clicked === 'save', { timeout: 5000 })
      await page.evaluate(() => delete document.body.dataset.clicked)
      // Turned off on the options page: open pages rebind at once.
      await ext.background.evaluate(() =>
        chrome.storage.sync.set({
          pageShortcuts: {
            version: 2,
            enabled: false,
            shortcuts: [
              { id: 'app', name: 'Open Apex Debugger', key: 'w', action: 'openApp' },
              { id: 'save', name: 'Save', key: 's', action: 'save' }
            ]
          }
        })
      )
      await delay(800)
      await page.focus('#accountName')
      await modS()
      await delay(300)
      assert.equal(await clicked(), null, 'off: Ctrl/Cmd+S does nothing')
    } finally {
      await ext.background.evaluate(() => chrome.storage.sync.remove('pageShortcuts'))
      await page.close()
    }
  }
)

// Reloading or updating the extension cuts the content scripts of open tabs
// off from it (chrome.runtime loses its id). The shortcuts script must then
// unbind its keys and say so, not throw. Its own browser: the reload kills
// the shared worker handle.
test(
  'page shortcuts: after an extension reload the keys say to reload the page',
  { skip: !MOCK && 'mock org only' },
  async () => {
    const own = await launchWithExtension({ mock: run.mock })
    try {
      const page = await own.browser.newPage()
      const messages = []
      page.on('console', m => messages.push(`${m.type()}: ${m.text()}`))
      page.on('pageerror', e => messages.push(`error: ${e.message}`))
      await page.goto(frontdoorUrl(session, '/setup/ui/listApexTraces.apexp'), { waitUntil: 'networkidle2' })
      await page.waitForFunction(
        () => location.pathname.includes('listApexTraces') && document.readyState === 'complete'
      )
      await delay(1000)
      await own.background.evaluate(() => chrome.runtime.reload())
      await page.waitForFunction(() => !(window.chrome && chrome.runtime && chrome.runtime.id), { timeout: 10000 })
      const before = messages.length
      await page.bringToFront()
      await page.keyboard.down('Shift')
      await page.keyboard.press('KeyW')
      await page.keyboard.up('Shift')
      await delay(1500)
      const after = messages.slice(before)
      assert.ok(
        after.some(m => m.startsWith('log:') && m.includes('Reload this page')),
        `tells the user to reload the page: ${after.join(' | ')}`
      )
      assert.ok(!after.some(m => m.startsWith('error:')), `no page error: ${after.join(' | ')}`)
      assert.equal(
        (await own.browser.pages()).filter(p => p.url().includes('/html/app.html')).length,
        0,
        'no app opened'
      )
    } finally {
      await own.close()
    }
  }
)

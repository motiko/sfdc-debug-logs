// End-to-end flow: run Apex in the org, then check the resulting debug log in
// both of the extension's views:
//   - classic view: the content script on Salesforce's log detail page
//     (chrome/app/js/sfdc.debug.js, themes in chrome/app/css/debug.css)
//   - React app: html/app.html opened with Shift+W (react/src/pages/logs)
// For each view: the log is visible, it can be searched, and every theme
// applies its color/font rules to every event type in the log.
//
// Credentials: .env.local (see scripts/lib/sf-auth.mjs). Run: npm test (in e2e/)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { login, frontdoorUrl } from '../scripts/lib/sf-auth.mjs'
import { Salesforce } from './lib/salesforce.mjs'
import { launchWithExtension } from './lib/browser.mjs'
import {
  classicThemes,
  defaultLogThemes,
  logEventToType,
  computedValue,
  toRgb
} from './lib/styles.mjs'

const MARKER = `E2E_MARKER_${Date.now()}`
const APEX = `
String marker = '${MARKER}';
System.debug(marker);
System.debug(JSON.serialize(new Map<String, Object>{ 'marker' => marker, 'n' => 42 }));
List<User> users = [SELECT Id, Name FROM User LIMIT 1];
try { Integer x = 1 / 0; } catch (Exception e) { System.debug('caught ' + e.getMessage()); }
`

const ARTIFACTS = join(dirname(fileURLToPath(import.meta.url)), 'artifacts')

let session, sf, log, ext

before(async () => {
  session = await login()
  sf = new Salesforce(session)
  await sf.ensureLogging()
  const since = new Date(Date.now() - 60000)
  await sf.executeAnonymous(APEX)
  log = await sf.findLog(MARKER, { since })
  // No token is saved on the options page: the extension has to find the
  // session itself, from the HttpOnly sid cookie that frontdoor.jsp sets.
  ext = await launchWithExtension()
})

after(() => ext && ext.close())

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

const classicUrl = id => `/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${id}`

test('classic log view', async t => {
  const page = await ext.browser.newPage()
  const errors = collectPageErrors(page)
  await page.goto(frontdoorUrl(session, classicUrl(log.Id)), { waitUntil: 'networkidle2' })
  await page.waitForSelector('#debugText div', { timeout: 20000 })

  await t.test('log is visible', async () => {
    const visible = await page.evaluate(marker => {
      const line = [...document.querySelectorAll('#debugText .debug')].find(d =>
        d.textContent.includes(marker)
      )
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
    const categories = ['debug', 'soql', 'system', 'rest', 'method', 'err']
    const present = await page.evaluate(
      cats => cats.filter(c => document.querySelector(`#debugText div.${c}`)),
      categories
    )
    assert.deepEqual(present, categories)
  })

  const themes = classicThemes()
  for (const [theme, { background, classes }] of Object.entries(themes)) {
    await t.test(`theme "${theme}" applies to every event type`, async () => {
      await page.select('#styleSelection', theme)
      const actual = await page.evaluate(
        (classNames, props) => {
          const root = document.querySelector('#debugText')
          const result = { className: root.className, background: getComputedStyle(root).backgroundColor, classes: {} }
          for (const cls of classNames) {
            const el = root.querySelector(`div.${cls}`)
            if (!el) continue
            const style = getComputedStyle(el)
            result.classes[cls] = Object.fromEntries(props.map(p => [p, style.getPropertyValue(p)]))
          }
          return result
        },
        Object.keys(classes),
        [...new Set(Object.values(classes).flatMap(Object.keys))]
      )
      assert.equal(actual.className, theme)
      assert.equal(actual.background, toRgb(background), 'background color')
      for (const cls of Object.keys(actual.classes)) {
        for (const [prop, value] of Object.entries(classes[cls])) {
          assert.ok(
            actual.classes[cls][prop].startsWith(computedValue(prop, value)),
            `.${theme} .${cls} ${prop}: expected ${value}, got ${actual.classes[cls][prop]}`
          )
        }
      }
    })
  }

  await t.test('font size applies', async () => {
    await page.select('#fontSelection', '14')
    const size = await page.$eval('#debugText', el => getComputedStyle(el).fontSize)
    assert.equal(size, '14px')
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
  const appTarget = ext.browser.waitForTarget(t => t.url().includes('/html/app.html'), {
    timeout: 30000
  })
  // The shortcut is bound only after an async message to the service
  // worker, so retry the key press until the app tab opens.
  let opened = false
  appTarget.then(() => (opened = true), () => {})
  for (let i = 0; i < 20 && !opened; i++) {
    await sfPage.keyboard.down('Shift')
    await sfPage.keyboard.press('KeyW')
    await sfPage.keyboard.up('Shift')
    await new Promise(r => setTimeout(r, 1000))
  }
  let app
  try {
    app = await (await appTarget).page()
  } catch (e) {
    await saveArtifacts(sfPage, 'shift-w', consoleLog)
    throw new Error(`Shift+W did not open the app (${e.message}); see e2e/artifacts/`)
  }
  // Network failures (e.g. unreachable optional services) are not page bugs.
  const errors = collectPageErrors(app)
  await app.setViewport({ width: 1400, height: 1000 })

  const rows = () => app.$$eval('tbody tr', trs => trs.map(tr => tr.innerText))
  const search = async term => {
    await app.click('#search', { clickCount: 3 })
    await app.type('#search', term)
    await app.keyboard.press('Enter')
    await app.waitForFunction(
      () => /Found \d+ matching logs/.test(document.body.innerText),
      { timeout: 30000 }
    )
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
    await app.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, {
      timeout: 30000
    })
    const listed = await rows()
    assert.ok(
      listed.some(r => r.includes(log.Operation)),
      `a row for ${log.Operation} is listed`
    )
  })

  await t.test('light theme: white background, dark text, teal toolbar', async () => {
    const colors = await app.evaluate(() => {
      const cell = document.querySelector('tbody td')
      let bg = cell
      while (bg && getComputedStyle(bg).backgroundColor === 'rgba(0, 0, 0, 0)') bg = bg.parentElement
      const search = document.querySelector('#search')
      return {
        tableBackground: bg ? getComputedStyle(bg).backgroundColor : 'none',
        cellText: getComputedStyle(cell).color,
        toolbar: getComputedStyle(document.querySelector('header')).backgroundColor,
        searchText: getComputedStyle(search).color
      }
    })
    const luminance = rgb => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number)
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    }
    assert.equal(colors.tableBackground, 'rgb(255, 255, 255)', 'log table background')
    assert.ok(luminance(colors.cellText) < 0.3, `table text is dark (${colors.cellText})`)
    assert.equal(colors.toolbar, toRgb('#009688'), 'toolbar is teal')
    assert.ok(luminance(colors.searchText) > 0.9, `toolbar search text is white (${colors.searchText})`)
  })

  await t.test('search finds the log and hides non-matching ones', async () => {
    await search(MARKER)
    assert.equal((await rows()).length, 1, 'only the log containing the marker remains')
    await search(`NO_SUCH_TEXT_${Date.now()}`)
    assert.equal((await rows()).length, 0, 'an unknown term matches no logs')
    await app.click('#search', { clickCount: 3 })
    await app.keyboard.press('Escape')
    await app.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0)
  })

  await t.test('operation filter reloads only matching logs', async () => {
    const dialog = '#form-dialog-title'
    const closeDialog = async () => {
      await app.evaluate(dialog => {
        const paper = document.querySelector(dialog).parentElement
        ;[...paper.querySelectorAll('button')].find(b => /close/i.test(b.innerText)).click()
      }, dialog)
      await app.waitForSelector(dialog, { hidden: true })
    }
    const reload = async () => {
      const errorsBefore = errors.length
      await app.click('button[aria-label="Load logs"]')
      await app.waitForFunction(
        () => !document.querySelector('[role="progressbar"]') && document.querySelectorAll('tbody tr').length > 0,
        { timeout: 30000 }
      )
      assert.deepEqual(errors.slice(errorsBefore), [], 'no page errors while loading logs')
    }
    await app.click('button[aria-label="Filter logs"]')
    await app.waitForSelector(dialog, { visible: true })
    // The three text filters (user, operation, status) are selects, in that order.
    const selects = await app.$$('[aria-haspopup="true"]')
    await selects[1].click()
    const option = `::-p-xpath(//li[@role="option" and normalize-space()="${log.Operation}"])`
    await app.waitForSelector(option, { visible: true })
    await app.click(option)
    await app.waitForSelector(option, { hidden: true })
    await closeDialog()
    await reload()
    const listed = await rows()
    assert.ok(listed.every(r => r.includes(log.Operation)), `every row is a ${log.Operation} log`)

    await app.click('button[aria-label="Filter logs"]')
    await app.waitForSelector(dialog, { visible: true })
    await app.evaluate(dialog => {
      const paper = document.querySelector(dialog).parentElement
      ;[...paper.querySelectorAll('button')].find(b => /clear filters/i.test(b.innerText)).click()
    }, dialog)
    await closeDialog()
    await reload()
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

  // material-ui 1.0 beta dialogs have no role="dialog"; use the title id.
  const DIALOG = '#form-dialog-title'
  const openStyleDialog = async () => {
    await app.click('button[aria-label="Style settings"]')
    await app.waitForSelector(DIALOG, { visible: true })
  }
  const closeStyleDialog = async () => {
    await app.evaluate(dialog => {
      const paper = document.querySelector(dialog).parentElement
      ;[...paper.querySelectorAll('button')].find(b => /close/i.test(b.innerText)).click()
    }, DIALOG)
    await app.waitForSelector(DIALOG, { hidden: true })
  }
  // Sets a React-controlled input's value the way a user edit would.
  const setInput = (selectorOrHandle, value) =>
    app.evaluate(
      (target, value) => {
        const el = typeof target === 'string' ? document.querySelector(target) : target
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      selectorOrHandle,
      value
    )
  const renderedStyles = () =>
    app.evaluate(() => {
      const pre = document.querySelector('pre')
      return {
        background: getComputedStyle(pre.parentElement).backgroundColor,
        fontSize: getComputedStyle(pre).fontSize,
        whiteSpace: getComputedStyle(pre).whiteSpace,
        elements: [...pre.children].slice(1).map(div => ({
          text: div.innerText.slice(0, 80),
          color: getComputedStyle(div).color
        }))
      }
    })
  // Category the app assigns to a log line (same rule as parsed-log.js).
  const categoryOf = text => {
    const event = (text.match(/\|([A-Z_]+)/) || [])[1] || ''
    const match = Object.entries(logEventToType).find(([prefix]) => event.startsWith(prefix))
    return match ? match[1] : 'rest'
  }

  const THEME_SELECT = '[aria-haspopup="true"]'
  const themeOptions = () => app.$$('li[role="option"]')

  await t.test('theme menu opens on click', async () => {
    await openStyleDialog()
    await app.click(THEME_SELECT)
    await new Promise(r => setTimeout(r, 500))
    const opened = (await themeOptions()).length > 0
    if (opened) await app.keyboard.press('Escape')
    await closeStyleDialog()
    assert.ok(opened, 'clicking the Log Color Theme select shows the theme list')
  })

  for (const [name, theme] of Object.entries(defaultLogThemes)) {
    await t.test(`theme "${name}" applies to every event type`, async () => {
      await openStyleDialog()
      // Opened with the keyboard so theme coverage doesn't depend on the
      // click check above.
      await app.focus(THEME_SELECT)
      await app.keyboard.press('ArrowDown')
      const option = `::-p-xpath(//li[@role="option" and normalize-space()="${name}"])`
      await app.waitForSelector(option, { visible: true })
      await app.click(option)
      await app.waitForSelector(option, { hidden: true })
      await closeStyleDialog()
      const styles = await renderedStyles()
      assert.equal(styles.background, toRgb(theme.background), 'background color')
      const failures = []
      for (const el of styles.elements) {
        const category = categoryOf(el.text)
        if (!theme[category]) {
          failures.push(`theme has no color for category "${category}" (${el.text})`)
        } else if (el.color !== toRgb(theme[category])) {
          failures.push(`${category}: expected ${theme[category]}, got ${el.color} (${el.text})`)
        }
      }
      assert.deepEqual([...new Set(failures)], [])
    })
  }

  await t.test('custom color applies', async () => {
    await openStyleDialog()
    const input = await app.evaluateHandle(() =>
      [...document.querySelectorAll('input[name="color"]')].find(i =>
        i.parentElement.parentElement.innerText.startsWith('Debug')
      )
    )
    await setInput(input, '#123456')
    await closeStyleDialog()
    const { elements } = await renderedStyles()
    const debugLine = elements.find(e => e.text.includes('|USER_DEBUG|'))
    assert.equal(debugLine.color, toRgb('#123456'))
  })

  await t.test('font size applies', async () => {
    await openStyleDialog()
    await setInput('input#number', '13')
    await closeStyleDialog()
    assert.equal((await renderedStyles()).fontSize, '13px')
  })

  await t.test('text wrap toggle applies', async () => {
    const before = (await renderedStyles()).whiteSpace
    await openStyleDialog()
    await app.click('input[type="checkbox"]')
    await closeStyleDialog()
    const afterToggle = (await renderedStyles()).whiteSpace
    assert.notEqual(afterToggle, before, `white-space stays "${before}" after toggling Text Wrap`)
  })

  const unexpected = errors.filter(e => !/Failed to fetch/.test(e))
  if (unexpected.length) t.diagnostic(`page errors: ${unexpected.join(' | ')}`)
})

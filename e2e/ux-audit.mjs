// UX/UI audit: captures screenshots of every view of the extension in a real
// browser against the org from .env.local (or, with --mock, the offline mock
// org of e2e/mock/), and runs automated checks on each
// captured state (axe-core, WCAG contrast, control names, clickable but not
// focusable elements, small and clipped text, keyboard focus order and focus
// indicators, dialog focus return). Used by the ux-ui-review agent
// (.claude/agents/ux-ui-review.md), and meant to be rerun after UI changes.
//
//   node ux-audit.mjs [--out <dir>] [--views app,classic,options,exec,trace]
//                     [--sizes 1440x900,1024x768] [--compare <previous out dir>]
//                     [--mock]
//
// Output (default e2e/ux-artifacts/, gitignored):
//   <view>-<state>@<W>x<H>.png   screenshot of each state
//   <view>-<state>@<W>x<H>.json  checks for that state
//   <view>-keyboard*.json        Tab order, focus indicators, dialog focus return
//   summary.json                 counts per state (input for --compare), and
//                                the Salesforce API requests of the run
//
// Finding things on the page: views are found by role, accessible name and
// visible text (helpers below), so the script survives a redesign. The few
// legacy selectors that remain are last-resort fallbacks inside the
// view-specific functions (appView, classicViews, optionsView).
//
// Safety: the org may be shared with other runs. The script never deletes
// logs: it never clicks a control named like delete/remove/clear all (except
// the app's "Delete logs…" menu item, which only opens a confirmation dialog
// that the script cancels with Escape), never
// types outside a verified focused input (the app and the classic list bind
// single-letter hotkeys such as "a" for delete all), dismisses every
// confirm() and only sends Tab, Shift+Tab, Escape, arrows and Enter on
// verified targets. Session ids are redacted from everything it writes.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { frontdoorUrl } from '../scripts/lib/sf-auth.mjs'
import { startRun } from './lib/run.mjs'
import { logThemes } from './lib/styles.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const AXE_PATH = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: join(HERE, 'ux-artifacts') },
    views: { type: 'string', default: 'app,classic,options,exec,trace' },
    sizes: { type: 'string', default: '1440x900,1024x768' },
    compare: { type: 'string' },
    mock: { type: 'boolean', default: process.env.SF_MOCK === '1' }
  }
})
const OUT = resolve(args.out)
const VIEWS = args.views.split(',').map(s => s.trim())
const SIZES = args.sizes.split(',').map(s => {
  const [width, height] = s.split('x').map(Number)
  return { width, height, label: `${width}x${height}` }
})

// Never activated by the script (see Safety above).
const DANGEROUS = /delete|remove|clear all|purge|erase|reset/i

const delay = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ---------------------------------------------------------------------------
// Test data: a realistic log (plain text, JSON, SObject lists, SOQL, caught
// exceptions, a few hundred lines) and a failed run (uncaught exception).

const MARKER = `UXAUDIT${Date.now()}` // upper case and digits only: no hotkeys
const APEX = `
String marker = '${MARKER}';
System.debug('Starting UX audit run ' + marker);
Map<String, Object> payload = new Map<String, Object>{
  'marker' => marker,
  'items' => new List<Object>{ 1, 2, 3 },
  'nested' => new Map<String, Object>{ 'ok' => true, 'name' => 'Acme', 'tags' => new List<String>{ 'a', 'b' } }
};
System.debug(JSON.serialize(payload));
List<User> users = [SELECT Id, Name, Username, IsActive FROM User WHERE IsActive = true LIMIT 5];
System.debug(marker + ' users ' + users);
List<Account> accounts = [SELECT Id, Name, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 5];
System.debug(LoggingLevel.WARN, 'accounts ' + accounts);
Integer total = 0;
for (Integer i = 0; i < 150; i++) {
  total += i;
  System.debug('iteration ' + i + ' running total ' + total);
}
try {
  Integer x = 1 / 0;
} catch (Exception e) {
  System.debug(LoggingLevel.ERROR, 'caught ' + e.getTypeName() + ': ' + e.getMessage());
}
try {
  Account missing = [SELECT Id FROM Account WHERE Name = 'no such account ${MARKER}' LIMIT 1];
} catch (QueryException e) {
  System.debug(LoggingLevel.ERROR, e.getMessage() + ' ' + e.getStackTraceString());
}
System.debug('Limits: queries ' + Limits.getQueries() + '/' + Limits.getLimitQueries() + ', CPU ' + Limits.getCpuTime());
System.debug('Done ' + marker);
`
const FAILING_APEX = `
System.debug('UX audit failing run ${MARKER}');
Integer y = 1 / 0;
`

// The log summary's limit levels and loop hints: 95 of 100 queries (over
// 90 %) and 110 of 150 DML statements (over 70 %), each in a loop, no errors.
// Mock org only: it changes no data there, and it would spend the real org's
// limits on nothing.
const LIMITS_APEX = `
System.debug('UX audit limits run ${MARKER}');
for (Integer i = 0; i < 95; i++) { List<Account> a = [SELECT Id, Name FROM Account LIMIT 1]; }
for (Integer i = 0; i < 110; i++) { insert new Account(Name = 'UX audit'); }
System.debug('Limits done ${MARKER}');
`

async function produceLogs(sf, { mock }) {
  await sf.ensureLogging()
  const since = new Date(Date.now() - 60000)
  await sf.executeAnonymous(APEX)
  await sf.executeAnonymous(FAILING_APEX).catch(() => {}) // fails on purpose
  let limits = null
  if (mock) {
    await sf.executeAnonymous(LIMITS_APEX)
    limits = await sf.findLog(`Limits done ${MARKER}`, { since })
  }
  // Both logs in one search (each body downloaded once); the failed run is
  // optional.
  const both = await sf.findLogs([`Done ${MARKER}`, `failing run ${MARKER}`], { since }).catch(() => null)
  const main = both ? both[`Done ${MARKER}`] : await sf.findLog(`Done ${MARKER}`, { since })
  const failed = both ? both[`failing run ${MARKER}`] : null
  log(`log ${main.Id}: ${main.body.split('\n').length} lines`)
  return { main, failed, limits }
}

// ---------------------------------------------------------------------------
// Output

let SESSION_ID = ''
const redact = text => {
  let s = String(text).replace(/sid=[^&\s"']+/g, 'sid=<redacted>')
  if (SESSION_ID) s = s.split(SESSION_ID).join('<redacted>')
  if (SESSION_ID) s = s.split(encodeURIComponent(SESSION_ID)).join('<redacted>')
  return s
}
const writeJson = (name, data) => writeFileSync(join(OUT, name), redact(JSON.stringify(data, null, 2)) + '\n')

const summary = {
  marker: MARKER,
  startedAt: new Date().toISOString(),
  sizes: SIZES.map(s => s.label),
  states: {},
  keyboard: {},
  errors: []
}

// ---------------------------------------------------------------------------
// In-page checks. One function, run with page.evaluate, so it has no closure.
// `scope`: CSS selectors of the extension's own UI on Salesforce pages; only
// elements inside them are checked (null: the whole page).

function pageChecks(scope) {
  const parse = str => {
    const m = str && str.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  })
  const lum = c => {
    const f = v => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
    return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100
  }
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  // Background behind an element: its own and its ancestors' backgrounds,
  // composited down to the first opaque one (white below everything).
  const effectiveBackground = el => {
    const layers = []
    let image = false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') image = true
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) bg = blend(layer, bg)
    return { bg, image }
  }
  const opacity = el => {
    let o = 1
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const describe = el => {
    const parts = []
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase()
      if (n.id) s += '#' + n.id
      else if (n.getAttribute('role')) s += `[role=${n.getAttribute('role')}]`
      else if (typeof n.className === 'string' && n.className.trim())
        s += '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.')
      parts.unshift(s)
      if (n.id) break
    }
    return parts.join(' > ')
  }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && opacity(el) > 0.05
  }
  const inScope = el => !scope || scope.some(sel => el.closest(sel))
  const inViewport = el => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  }

  // Text elements: parents of non-empty text nodes.
  const textEls = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue
    const el = t.parentElement
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue
    textEls.add(el)
  }
  // Text shown in form controls: values and placeholders.
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (['hidden', 'checkbox', 'radio', 'range', 'color'].includes(el.type)) continue
    if ((el.value && String(el.value).trim()) || el.getAttribute('placeholder')) textEls.add(el)
  }
  const contrastGroups = new Map()
  const small = new Map()
  const clipped = []
  let checked = 0
  for (const el of textEls) {
    if (!inScope(el) || !visible(el)) continue
    checked++
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const { bg, image } = effectiveBackground(el)
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
    const showsPlaceholder = isField && el.tagName !== 'SELECT' && !el.value && el.getAttribute('placeholder')
    const fg0 = parse(showsPlaceholder ? getComputedStyle(el, '::placeholder').color : cs.color) || {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    }
    const fg = blend({ ...fg0, a: fg0.a * opacity(el) }, bg)
    const r = ratio(fg, bg)
    const min = large ? 3 : 4.5
    const text = isField
      ? `${showsPlaceholder ? 'placeholder' : 'value'}: ${showsPlaceholder ? el.getAttribute('placeholder') : el.tagName === 'SELECT' ? (el.selectedOptions[0] || {}).textContent : el.value}`.slice(
          0,
          60
        )
      : el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (r < min) {
      const key = `${hex(fg)}|${hex(bg)}|${large}`
      const g = contrastGroups.get(key) || {
        foreground: hex(fg),
        background: hex(bg),
        ratio: r,
        required: min,
        large,
        backgroundImage: image,
        fontSize: size,
        count: 0,
        inViewport: 0,
        examples: []
      }
      g.count++
      if (inViewport(el)) g.inViewport++
      if (g.examples.length < 3) g.examples.push({ text, element: describe(el) })
      contrastGroups.set(key, g)
    }
    if (size < 12) {
      const key = `${size}`
      const g = small.get(key) || { fontSize: size, count: 0, examples: [] }
      g.count++
      if (g.examples.length < 3) g.examples.push({ text, element: describe(el) })
      small.set(key, g)
    }
    // Cut off: the element overflows itself with overflow hidden/ellipsis,
    // or sticks out of a non-scrolling ancestor that clips.
    // Visually hidden text for screen readers (1 px, clipped) isn't cut off.
    const srOnly = el.offsetWidth <= 1 && el.offsetHeight <= 1 && /hidden|clip/.test(cs.overflowX)
    if (clipped.length < 40 && !srOnly) {
      let cut = null
      const ov = cs.overflowX + ' ' + cs.overflowY
      if (/hidden|clip/.test(ov) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
        cut = 'overflows itself'
      else if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) cut = 'ellipsis'
      else {
        // The text's own box, not the element's (padding may bleed harmlessly).
        let er = el.getBoundingClientRect()
        if (!isField) {
          const range = document.createRange()
          range.selectNodeContents(el)
          const tr = range.getBoundingClientRect()
          if (tr.width > 0 && tr.height > 0) er = tr
        }
        let n = el.parentElement
        for (let i = 0; n && i < 6; i++, n = n.parentElement) {
          const ncs = getComputedStyle(n)
          if (/auto|scroll/.test(ncs.overflowX + ncs.overflowY)) break
          if (/hidden|clip/.test(ncs.overflowX + ncs.overflowY)) {
            const nr = n.getBoundingClientRect()
            if (er.right > nr.right + 2 || er.bottom > nr.bottom + 2 || er.left < nr.left - 2) {
              cut = `clipped by ${describe(n)}`
              break
            }
          }
        }
      }
      if (cut) clipped.push({ text, element: describe(el), reason: cut })
    }
  }

  // Non-text contrast (3:1): icons and the boundaries of inputs.
  const nonText = new Map()
  const addNonText = (el, kind, color) => {
    const parent = el.parentElement || el
    const { bg } = effectiveBackground(kind === 'input border' ? parent : el)
    const c = parse(color)
    if (!c || c.a === 0) return
    const fg = blend({ ...c, a: c.a * opacity(el) }, bg)
    const r = ratio(fg, bg)
    if (r >= 3) return
    const key = `${kind}|${hex(fg)}|${hex(bg)}`
    const g = nonText.get(key) || {
      kind,
      foreground: hex(fg),
      background: hex(bg),
      ratio: r,
      required: 3,
      count: 0,
      examples: []
    }
    g.count++
    if (g.examples.length < 3) g.examples.push(describe(el))
    nonText.set(key, g)
  }
  for (const svg of document.querySelectorAll('svg')) {
    if (!inScope(svg) || !visible(svg)) continue
    const cs = getComputedStyle(svg)
    addNonText(svg, 'icon', cs.fill && cs.fill !== 'none' ? cs.fill : cs.color)
  }
  for (const input of document.querySelectorAll(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea'
  )) {
    if (!inScope(input) || !visible(input)) continue
    // The visible boundary: own border, or an underline/outline on a wrapper.
    let n = input
    let boundary = null
    for (let i = 0; n && i < 3; i++, n = n.parentElement) {
      const cs = getComputedStyle(n)
      const w = parseFloat(cs.borderBottomWidth)
      if (w > 0 && cs.borderBottomStyle !== 'none') {
        boundary = cs.borderBottomColor
        break
      }
      // An outline drawn by a sibling (MUI's outlined inputs: a <fieldset>
      // next to the input, inside the same wrapper).
      const outline = n !== input && n.querySelector(':scope > fieldset')
      if (outline) {
        const ocs = getComputedStyle(outline)
        if (parseFloat(ocs.borderBottomWidth) > 0 && ocs.borderBottomStyle !== 'none') {
          boundary = ocs.borderBottomColor
          break
        }
      }
      // Underlines drawn by a pseudo-element: a bottom border, or a thin bar
      // with a background (material-ui's Input).
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(n, pseudo)
        if (p.content === 'none' || p.display === 'none') continue
        if (parseFloat(p.borderBottomWidth) > 0 && p.borderBottomStyle !== 'none') boundary = p.borderBottomColor
        else if (
          parseFloat(p.height) > 0 &&
          parseFloat(p.height) <= 3 &&
          parse(p.backgroundColor) &&
          parse(p.backgroundColor).a > 0 &&
          p.transform.indexOf('matrix(0') !== 0
        )
          boundary = p.backgroundColor
        if (boundary) break
      }
      if (boundary) break
    }
    if (boundary) addNonText(input, 'input border', boundary)
    else if (!parse(getComputedStyle(input).backgroundColor) || parse(getComputedStyle(input).backgroundColor).a === 0)
      nonText.set(`noboundary|${describe(input)}`, {
        kind: 'input without visible boundary',
        count: 1,
        examples: [describe(input)]
      })
  }

  // Clickable but not focusable: elements with a click handler (React props
  // or onclick) or a pointer cursor that set it themselves, that neither are
  // nor sit inside something focusable.
  const focusableSel =
    'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'
  const isFocusable = el => {
    const f = el.closest(focusableSel)
    return Boolean(
      f && !(f.getAttribute('tabindex') === '-1' && !f.matches('a[href], button, input, select, textarea'))
    )
  }
  const reactClick = el => {
    for (const key of Object.keys(el)) {
      if (key.startsWith('__reactEventHandlers') || key.startsWith('__reactProps')) {
        const props = el[key]
        if (props && (props.onClick || props.onMouseDown || props.onMouseUp)) return true
      }
    }
    return false
  }
  const clickable = []
  let clickableTotal = 0
  for (const el of document.querySelectorAll('body *')) {
    if (!inScope(el)) continue
    const cs = getComputedStyle(el)
    const pointer =
      cs.cursor === 'pointer' && el.parentElement && getComputedStyle(el.parentElement).cursor !== 'pointer'
    if (!(reactClick(el) || typeof el.onclick === 'function' || pointer)) continue
    if (!visible(el) || isFocusable(el)) continue
    // A wrapper that passes clicks to a control inside it (React's root,
    // MUI's input wrappers) is reachable through that control.
    if (el.querySelector(focusableSel)) continue
    clickableTotal++
    if (clickable.length < 30)
      clickable.push({
        element: describe(el),
        text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
        why: reactClick(el) ? 'click handler' : typeof el.onclick === 'function' ? 'onclick' : 'pointer cursor',
        role: el.getAttribute('role')
      })
  }

  // Controls covered by something else at their center (e.g. a toolbar that
  // wrapped under the content): they can't be clicked.
  const obscured = []
  for (const el of document.querySelectorAll(
    'a[href], button, input, select, textarea, [role=button], [role=slider], [role=switch]'
  )) {
    if (!inScope(el) || !visible(el) || el.type === 'hidden') continue
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue
    const hit = document.elementFromPoint(x, y)
    if (!hit || el === hit || el.contains(hit) || hit.contains(el)) continue
    // Ignore modal backdrops and open dialogs/menus (expected to cover).
    if (
      hit.closest('[role=dialog], [role=presentation], [role=listbox], [role=menu], [role=tooltip], [aria-modal=true]')
    )
      continue
    let overlay = false
    for (let n = hit; n && n.nodeType === 1; n = n.parentElement) {
      const nr = n.getBoundingClientRect()
      if (getComputedStyle(n).position === 'fixed' && nr.width >= innerWidth * 0.9 && nr.height >= innerHeight * 0.9) {
        overlay = !n.contains(el)
        break
      }
    }
    if (overlay) continue
    if (obscured.length < 30)
      obscured.push({
        element: describe(el),
        name: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40),
        coveredBy: describe(hit)
      })
  }

  return {
    obscuredControls: obscured,
    textElementsChecked: checked,
    contrast: [...contrastGroups.values()].sort((a, b) => a.ratio - b.ratio),
    nonTextContrast: [...nonText.values()],
    smallText: [...small.values()],
    clippedText: clipped,
    clickableNotFocusable: { count: clickableTotal, examples: clickable }
  }
}

// Interactive accessibility-tree nodes without a name, from Chrome's own
// accessible name computation (CDP Accessibility.getFullAXTree).
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'checkbox',
  'switch',
  'slider',
  'spinbutton',
  'menuitem',
  'option',
  'tab',
  'radio',
  'listbox',
  'PopUpButton',
  'ComboBoxSelect'
])
async function unnamedControls(page, scope) {
  const cdp = await page.createCDPSession()
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree')
    const results = []
    for (const node of nodes) {
      const role = node.role && node.role.value
      if (node.ignored || !INTERACTIVE_ROLES.has(role)) continue
      const name = node.name && node.name.value && String(node.name.value).trim()
      if (name) continue
      if (!node.backendDOMNodeId) continue
      const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: node.backendDOMNodeId }).catch(() => ({}))
      if (!object || !object.objectId) continue
      const { result } = await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        returnByValue: true,
        arguments: [{ value: scope }],
        functionDeclaration: `function (scope) {
          const el = this.nodeType === 1 ? this : this.parentElement
          if (!el) return null
          if (scope && !scope.some(s => el.closest(s))) return null
          const r = el.getBoundingClientRect()
          if (r.width < 1 || r.height < 1) return null
          const parts = []
          for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
            let s = n.tagName.toLowerCase()
            if (n.id) s += '#' + n.id
            else if (typeof n.className === 'string' && n.className.trim()) s += '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.')
            parts.unshift(s)
            if (n.id) break
          }
          return { element: parts.join(' > '), html: el.outerHTML.slice(0, 160) }
        }`
      })
      if (result && result.value) results.push({ role, ...result.value })
      await cdp.send('Runtime.releaseObject', { objectId: object.objectId }).catch(() => {})
    }
    return results
  } finally {
    await cdp.detach().catch(() => {})
  }
}

async function runAxe(page, scope) {
  const has = await page.evaluate(() => typeof window.axe !== 'undefined').catch(() => false)
  if (!has) {
    try {
      await page.addScriptTag({ path: AXE_PATH })
    } catch {
      // A strict CSP can block the tag; evaluate the source instead.
      await page.evaluate(readFileSync(AXE_PATH, 'utf8'))
    }
  }
  return page.evaluate(async scope => {
    const res = await window.axe.run(document, { resultTypes: ['violations'] })
    const inScope = target => {
      if (!scope) return true
      if (!Array.isArray(target) || target.length !== 1) return false
      try {
        const el = document.querySelector(target[0])
        return Boolean(el && scope.some(s => el.closest(s)))
      } catch {
        return false
      }
    }
    const shape = v => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({ target: n.target, html: n.html.slice(0, 200), summary: n.failureSummary }))
    })
    const own = []
    const host = []
    for (const v of res.violations) {
      const mine = v.nodes.filter(n => inScope(n.target))
      const theirs = v.nodes.filter(n => !inScope(n.target))
      if (mine.length) own.push(shape({ ...v, nodes: mine }))
      if (theirs.length) host.push({ id: v.id, impact: v.impact, nodes: theirs.length })
    }
    return { violations: own, hostPageViolations: scope ? host : undefined }
  }, scope)
}

// Screenshot plus every check for the current state of a page.
async function capture(ctx, page, view, state, { scope = null, fullPage = false } = {}) {
  const name = `${view}-${state}@${ctx.size.label}`
  await delay(400) // let transitions settle
  const png = join(OUT, `${name}.png`)
  await page.screenshot({ path: png, fullPage }).catch(e => log(`screenshot ${name} failed: ${e.message}`))
  const result = {
    view,
    state,
    size: ctx.size.label,
    url: redact(page.url()),
    title: await page.title().catch(() => '')
  }
  try {
    result.axe = await runAxe(page, scope)
  } catch (e) {
    result.axe = { error: e.message }
  }
  try {
    Object.assign(result, await page.evaluate(pageChecks, scope))
  } catch (e) {
    result.checksError = e.message
  }
  try {
    result.unnamedControls = await unnamedControls(page, scope)
  } catch (e) {
    result.unnamedControls = { error: e.message }
  }
  writeJson(`${name}.json`, result)
  const counts = {
    axe: Array.isArray(result.axe.violations) ? result.axe.violations.length : null,
    axeByImpact: Array.isArray(result.axe.violations)
      ? result.axe.violations.reduce((acc, v) => ({ ...acc, [v.impact]: (acc[v.impact] || 0) + 1 }), {})
      : null,
    contrastGroups: (result.contrast || []).length,
    contrastElements: (result.contrast || []).reduce((n, g) => n + g.count, 0),
    nonTextContrast: (result.nonTextContrast || []).length,
    unnamedControls: Array.isArray(result.unnamedControls) ? result.unnamedControls.length : null,
    clickableNotFocusable: result.clickableNotFocusable ? result.clickableNotFocusable.count : null,
    smallText: (result.smallText || []).reduce((n, g) => n + g.count, 0),
    clippedText: (result.clippedText || []).length,
    obscuredControls: (result.obscuredControls || []).length
  }
  summary.states[name] = { png: `${name}.png`, json: `${name}.json`, ...counts }
  log(`captured ${name}`, JSON.stringify(counts))
  return result
}

// ---------------------------------------------------------------------------
// Finding controls by role, name and text.

// Returns a handle to the first visible interactive element whose accessible
// name (approximated: aria-label, labelledby, label, title, text, value,
// placeholder) matches one of `patterns`, optionally inside `within`.
async function byName(page, patterns, { within = null, roles = null } = {}) {
  const sources = patterns.map(p => [p.source, p.flags])
  const handle = await page.evaluateHandle(
    (sources, within, roles) => {
      const res = sources.map(([s, f]) => new RegExp(s, f))
      const root = (within && document.querySelector(within)) || document
      const sel =
        'button, a, input, select, textarea, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=switch], [role=checkbox], [role=combobox], [aria-haspopup], [tabindex]'
      const nameOf = el => {
        const by = el.getAttribute('aria-labelledby')
        const parts = [
          el.getAttribute('aria-label'),
          by &&
            by
              .split(/\s+/)
              .map(id => (document.getElementById(id) || {}).textContent)
              .join(' '),
          el.labels && [...el.labels].map(l => l.textContent).join(' '),
          el.getAttribute('title'),
          el.textContent,
          el.value,
          el.getAttribute('placeholder')
        ]
        // A wrapping element's title (e.g. a tooltip) counts too.
        const titled = el.closest('[title]')
        if (titled) parts.push(titled.getAttribute('title'))
        // The same text twice (an aria-label and the tooltip's native title)
        // counts once.
        return [...new Set(parts.filter(Boolean).map(p => p.replace(/\s+/g, ' ').trim()))].join(' ')
      }
      const visible = el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      for (const re of res) {
        for (const el of root.querySelectorAll(sel)) {
          if (roles && !roles.includes(el.getAttribute('role') || el.tagName.toLowerCase())) continue
          if (visible(el) && re.test(nameOf(el))) return el
        }
      }
      return null
    },
    sources,
    within,
    roles
  )
  const el = handle.asElement()
  if (!el) await handle.dispose()
  return el
}

// The form control that belongs to a visible label matching `pattern`: an
// associated control, or the first control near the label.
async function controlByLabel(page, pattern, { within = null } = {}) {
  const handle = await page.evaluateHandle(
    (source, flags, within) => {
      const re = new RegExp(source, flags)
      const root = (within && document.querySelector(within)) || document
      const controls = 'select, input, textarea, [role=combobox], [aria-haspopup], [role=button], [role=slider]'
      const labelled = [...root.querySelectorAll(controls)].find(el => {
        const by = el.getAttribute('aria-labelledby')
        const name = [
          el.getAttribute('aria-label'),
          by &&
            by
              .split(/\s+/)
              .map(id => (document.getElementById(id) || {}).textContent)
              .join(' '),
          el.labels && [...el.labels].map(l => l.textContent).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
        return re.test(name)
      })
      if (labelled) return labelled
      const labels = [...root.querySelectorAll('label, legend, span, p, div')].filter(
        el => el.children.length === 0 && re.test(el.textContent)
      )
      for (const label of labels) {
        let n = label
        for (let i = 0; n && i < 4; i++, n = n.parentElement) {
          const c = n.querySelector(controls)
          if (c && c !== label) return c
        }
      }
      return null
    },
    pattern.source,
    pattern.flags,
    within
  )
  const el = handle.asElement()
  if (!el) await handle.dispose()
  return el
}

async function nameOf(handle) {
  return handle.evaluate(el =>
    [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent, el.value].filter(Boolean).join(' ').trim()
  )
}

async function safeClick(handle) {
  const name = await nameOf(handle)
  if (DANGEROUS.test(name)) throw new Error(`refusing to click "${name}"`)
  await handle.click()
}

// Types only after making sure the input has focus (stray keys can trigger
// page hotkeys such as delete all).
async function typeInto(page, handle, text) {
  await handle.focus()
  const focused = await handle.evaluate(el => document.activeElement === el)
  if (!focused) throw new Error('input did not take focus; not typing')
  await handle.evaluate(el => el.select && el.select())
  await page.keyboard.type(text)
}

// The open dialog: role=dialog/alertdialog/aria-modal, or (material-ui 1.0
// beta, which has neither) the paper around an aria-labelledby title.
async function openDialog(page) {
  const handle = await page.evaluateHandle(() => {
    const visible = el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const roleDialog = [
      ...document.querySelectorAll('[role=dialog], [role=alertdialog], [aria-modal=true], dialog[open]')
    ].find(visible)
    if (roleDialog) return roleDialog
    const labelled = [...document.querySelectorAll('[aria-labelledby]')].find(
      el => visible(el) && getComputedStyle(el).position === 'fixed'
    )
    return labelled || null
  })
  const el = handle.asElement()
  if (!el) await handle.dispose()
  return el
}

async function closeDialog(page) {
  await page.keyboard.press('Escape')
  await delay(500)
  if (await openDialog(page)) {
    const dialog = await openDialog(page)
    const close = await byName(page, [/^close$/i, /done/i, /cancel/i], {})
    if (close) await safeClick(close)
    await delay(500)
    await dialog.dispose()
  }
}

// Picks an option (by visible text) in a select-like control: native select,
// or a popup listbox.
async function chooseOption(page, control, optionText) {
  const native = await control.evaluate(el => el.tagName === 'SELECT')
  if (native) {
    await control.evaluate((el, text) => {
      const opt = [...el.options].find(o => o.textContent.trim() === text || o.value === text)
      el.value = opt.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, optionText)
    return
  }
  await control.click()
  const option = await page.waitForSelector(`::-p-xpath(//*[@role="option" and normalize-space()="${optionText}"])`, {
    visible: true,
    timeout: 5000
  })
  await option.click()
  await delay(400)
}

// The biggest scrollable area of the page (the log body), scrolled to `fraction`.
async function scrollMain(page, fraction) {
  return page.evaluate(fraction => {
    const scrollables = [document.scrollingElement, ...document.querySelectorAll('*')].filter(el => {
      if (!el || el.scrollHeight <= el.clientHeight + 50) return false
      if (el === document.scrollingElement) return true
      return /auto|scroll/.test(getComputedStyle(el).overflowY)
    })
    scrollables.sort((a, b) => b.scrollHeight - a.scrollHeight)
    const el = scrollables[0]
    if (!el) return null
    el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
  }, fraction)
}

// ---------------------------------------------------------------------------
// Keyboard: Tab through the page and record each stop, whether its focus is
// visible (pixels around the element change when it gets focus) and where
// the cycle ends.

async function describeActive(page) {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement) return { body: true }
    const r = el.getBoundingClientRect()
    const name = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.labels && [...el.labels].map(l => l.textContent).join(' '),
      el.textContent,
      el.value,
      el.getAttribute('placeholder')
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
    let path = el.tagName.toLowerCase()
    if (el.id) path += '#' + el.id
    return {
      element: path,
      role: el.getAttribute('role'),
      name,
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      focusVisibleMatches: el.matches(':focus-visible')
    }
  })
}

async function focusIndicatorVisible(page) {
  const clip = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return null
    const pad = 6
    const vv = window.visualViewport
    return {
      x: Math.max(0, r.x - pad + vv.pageLeft),
      y: Math.max(0, r.y - pad + vv.pageTop),
      width: Math.min(r.width + 2 * pad, innerWidth),
      height: Math.min(r.height + 2 * pad, innerHeight)
    }
  })
  if (!clip) return null
  const focused = await page.screenshot({ clip, captureBeyondViewport: false }).catch(() => null)
  const marker = await page.evaluate(() => {
    const el = document.activeElement
    window.__uxAuditRefocus = el
    el.blur()
    return true
  })
  await delay(250)
  const blurred = marker ? await page.screenshot({ clip, captureBeyondViewport: false }).catch(() => null) : null
  await page.evaluate(() => {
    const el = window.__uxAuditRefocus
    if (el) el.focus()
    delete window.__uxAuditRefocus
  })
  await delay(100)
  if (!focused || !blurred) return null
  return !Buffer.from(focused).equals(Buffer.from(blurred))
}

async function tabThrough(page, name, { maxStops = 60, start = 'document' } = {}) {
  // A blinking caret would read as a focus indicator in the pixel comparison.
  await page.evaluate(() => {
    if (document.getElementById('ux-audit-no-caret')) return
    const style = document.createElement('style')
    style.id = 'ux-audit-no-caret'
    style.textContent = '* { caret-color: transparent !important }'
    document.head.appendChild(style)
  })
  if (start === 'document') {
    // Start at the top of the page: focus a temporary, untabbable element
    // placed first in the body (blur alone keeps the browser's sequential
    // focus starting point where the last click or focus was).
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      const start = document.createElement('span')
      start.id = 'ux-audit-start'
      start.tabIndex = -1
      document.body.prepend(start)
      start.focus()
      window.focus()
    })
  }
  const tabbable = await page.evaluate(() => {
    const sel =
      'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return [...document.querySelectorAll(sel)].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && el.tabIndex >= 0
    }).length
  })
  const stops = []
  let stuck = 0
  let cycled = false
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab')
    await delay(200)
    if (i === 0) await page.evaluate(() => document.getElementById('ux-audit-start')?.remove())
    const stop = await describeActive(page)
    const prev = stops[stops.length - 1]
    // Focus inside an iframe keeps the iframe as activeElement: not a trap.
    if (
      prev &&
      !/^iframe/.test(stop.element || '') &&
      JSON.stringify(prev.rect) === JSON.stringify(stop.rect) &&
      prev.element === stop.element
    ) {
      if (++stuck >= 3) break
    } else stuck = 0
    if (!stop.body) stop.focusIndicatorVisible = await focusIndicatorVisible(page)
    if (
      stops.length > 1 &&
      !stop.body &&
      stops[0].element === stop.element &&
      JSON.stringify(stops[0].rect) === JSON.stringify(stop.rect)
    ) {
      cycled = true
      break
    }
    stops.push(stop)
  }
  const report = {
    page: name,
    tabbableElements: tabbable,
    stopsRecorded: stops.length,
    reachedMaxStops: stops.length >= maxStops,
    cycledBackToStart: cycled,
    stuck: stuck >= 3,
    withoutVisibleFocus: stops.filter(s => s.focusIndicatorVisible === false).length,
    offscreenStops: stops.filter(s => !s.body && !s.inViewport).length,
    stops
  }
  return report
}

// Opens a dialog with the keyboard from `trigger` and records where focus
// goes, whether Tab stays in the dialog, and whether Escape returns focus.
async function dialogKeyboard(page, trigger, label) {
  const result = { dialog: label }
  await trigger.focus()
  result.triggerFocused = await trigger.evaluate(el => document.activeElement === el)
  if (!result.triggerFocused) return { ...result, error: 'trigger did not take focus' }
  await page.keyboard.press('Enter')
  await delay(800)
  const dialog = await openDialog(page)
  result.opened = Boolean(dialog)
  if (!dialog) return result
  result.focusMovedIntoDialog = await dialog.evaluate(d => d.contains(document.activeElement))
  const inside = []
  const outside = []
  result.stops = []
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    await delay(120)
    const isInside = await dialog.evaluate(d => d.contains(document.activeElement))
    inside.push(isInside)
    const stop = await describeActive(page)
    result.stops.push({ inside: isInside, element: stop.element || 'body', name: stop.name })
    if (!isInside) outside.push(stop.body ? 'body' : `${stop.element} "${stop.name}"`)
  }
  result.tabStaysInDialog = inside.every(Boolean)
  result.tabStopsOutsideDialog = outside
  await page.keyboard.press('Escape')
  await delay(700)
  result.closedWithEscape = !(await openDialog(page))
  result.focusReturnedToTrigger = await trigger.evaluate(el => document.activeElement === el)
  result.focusAfterClose = await describeActive(page)
  if (!result.closedWithEscape) await closeDialog(page)
  await dialog.dispose()
  return result
}

function saveKeyboard(name, data) {
  writeJson(`${name}.json`, data)
  summary.keyboard[name] = Array.isArray(data)
    ? data.map(d => ({
        dialog: d.dialog,
        focusMovedIntoDialog: d.focusMovedIntoDialog,
        tabStaysInDialog: d.tabStaysInDialog,
        focusReturnedToTrigger: d.focusReturnedToTrigger
      }))
    : {
        tabbableElements: data.tabbableElements,
        stopsRecorded: data.stopsRecorded,
        withoutVisibleFocus: data.withoutVisibleFocus,
        offscreenStops: data.offscreenStops,
        cycledBackToStart: data.cycledBackToStart,
        stuck: data.stuck
      }
  log(`keyboard ${name}`, JSON.stringify(summary.keyboard[name]))
}

// ---------------------------------------------------------------------------
// Pages

async function newPage(ctx) {
  const page = await ctx.ext.browser.newPage()
  await page.setBypassCSP(true) // axe injection on Salesforce and extension pages
  await page.setViewport({ width: ctx.size.width, height: ctx.size.height })
  page.on('dialog', d => d.dismiss().catch(() => {})) // never confirm anything
  page.errors = []
  page.on('pageerror', e => page.errors.push(e.message))
  return page
}

async function gotoSalesforce(ctx, page, path) {
  await page.goto(frontdoorUrl(ctx.session, path), { waitUntil: 'networkidle2', timeout: 90000 })
  const target = path.split('?')[0]
  await page
    .waitForFunction(
      t => location.pathname.startsWith(t) && document.readyState === 'complete',
      { timeout: 60000 },
      target
    )
    .catch(() => log(`did not land on ${target}: ${redact(page.url())}`))
}

// The app's URL as the extension builds it (core/page-session.ts).
// `host` other than the org's: the real session id is never sent there; a
// placeholder is used instead, so an unknown host can't receive the session.
function appUrl(ctx, { host } = {}) {
  const { session, ext } = ctx
  const sid = host ? 'ux-audit-placeholder-session' : session.sessionId
  return (
    `chrome-extension://${ext.extensionId}/html/app.html?oid=${session.orgId}&uid=${session.userId}` +
    `&sid=${encodeURIComponent(sid)}&host=${encodeURIComponent(host || new URL(session.instance).hostname)}`
  )
}

// Opens the app the way users do (Shift+W on a Salesforce page); falls back
// to its URL if the shortcut doesn't fire.
async function openAppWithShortcut(ctx) {
  const sfPage = await newPage(ctx)
  await gotoSalesforce(ctx, sfPage, '/setup/ui/listApexTraces.apexp')
  await delay(2500) // shortcuts bind after the service worker answers
  const target = ctx.ext.browser.waitForTarget(t => t.url().includes('/html/app.html'), { timeout: 8000 })
  for (let i = 0; i < 3; i++) {
    await sfPage.bringToFront()
    await sfPage.evaluate(() => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur()
      window.focus()
    })
    await sfPage.keyboard.down('Shift')
    await sfPage.keyboard.press('KeyW')
    await sfPage.keyboard.up('Shift')
    const t = await Promise.race([target.catch(() => null), delay(2500).then(() => null)])
    if (t) {
      const app = await t.page()
      await sfPage.close()
      await app.setBypassCSP(true)
      await app.setViewport({ width: ctx.size.width, height: ctx.size.height })
      app.on('dialog', d => d.dismiss().catch(() => {}))
      app.errors = []
      app.on('pageerror', e => app.errors.push(e.message))
      // setBypassCSP applies from the next navigation.
      await app.reload({ waitUntil: 'networkidle2' })
      return { app, via: 'Shift+W' }
    }
  }
  await sfPage.close()
  const app = await newPage(ctx)
  await app.goto(appUrl(ctx), { waitUntil: 'networkidle2' })
  return { app, via: 'url (Shift+W did not fire)' }
}

const waitForText = (page, text, timeout = 30000) =>
  page.waitForFunction(t => document.body && document.body.innerText.includes(t), { timeout }, text)

// --- React log viewer (html/app.html) -------------------------------------

async function appView(ctx) {
  const V = 'app'
  const { logs } = ctx

  // Loading state: hold the API's query responses for a while.
  {
    const page = await newPage(ctx)
    await page.setRequestInterception(true)
    let held = 0
    page.on('request', req => {
      if (/\/services\/data\//.test(req.url())) {
        held++
        setTimeout(() => req.continue().catch(() => {}), 6000)
      } else req.continue().catch(() => {})
    })
    await page.goto(appUrl(ctx), { waitUntil: 'domcontentloaded' })
    await delay(1500)
    if (held) await capture(ctx, page, V, 'loading')
    else log('loading state: no API request seen to hold')
    await page.close()
  }

  // Error state: a host that can never resolve (.invalid, RFC 2606), with a
  // placeholder session id.
  {
    const page = await newPage(ctx)
    await page.goto(appUrl(ctx, { host: 'ux-audit.invalid' }), { waitUntil: 'domcontentloaded' })
    await page
      .waitForFunction(() => /error|fail|can.t reach|expired/i.test(document.body.innerText), { timeout: 20000 })
      .catch(() => {})
    await delay(300)
    await capture(ctx, page, V, 'error-unreachable-org')
    await delay(2500)
    await capture(ctx, page, V, 'error-after-message-hides')
    await page.close()
  }

  const { app, via } = await openAppWithShortcut(ctx)
  summary.appOpenedVia = via
  await app.bringToFront()
  await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await app.waitForSelector(`[data-log-id="${logs.main.Id}"]`, { timeout: 30000 }).catch(() => {})
  await delay(1500)
  await capture(ctx, app, V, 'list')
  if (ctx.primary) saveKeyboard(`${V}-keyboard-list`, await tabThrough(app, 'app list'))

  // The overflow menu, and items in it ("Appearance…", "Delete logs…").
  const openMoreActions = async () => {
    const more = await byName(app, [/^more actions$/i])
    if (!more) return false
    await safeClick(more)
    await delay(500)
    return true
  }
  const menuItem = async pattern => {
    if (!(await openMoreActions())) return null
    return byName(app, [pattern], { roles: ['menuitem'] })
  }
  const openAppearance = async () => {
    const item = await menuItem(/^appearance/i)
    if (!item) return false
    await safeClick(item)
    await delay(700)
    return true
  }

  if (await openMoreActions()) {
    await capture(ctx, app, V, 'more-actions-menu')
    await app.keyboard.press('Escape')
    await delay(400)
  }

  // A confirmation toast (extending logging, when it is on), alone and with
  // the overflow menu open over it: it must not cover the header's controls.
  {
    const logging = await byName(app, [/^logging on/i])
    let extend = null
    if (logging) {
      await safeClick(logging)
      await delay(500)
      extend = await byName(app, [/^extend/i], { roles: ['menuitem'] })
    }
    if (extend) {
      await safeClick(extend)
      await app.waitForSelector('[data-testid="toast"]', { visible: true, timeout: 15000 }).catch(() => {})
      await delay(300)
      await capture(ctx, app, V, 'toast')
      if (await openMoreActions()) {
        await capture(ctx, app, V, 'toast-with-menu')
        await app.keyboard.press('Escape')
        await delay(400)
      }
      await app.waitForSelector('[data-testid="toast"]', { hidden: true, timeout: 10000 }).catch(() => {})
    } else {
      if (logging) await app.keyboard.press('Escape')
      summary.errors.push('app: logging is not on, no toast captured')
    }
  }

  // Search.
  const searchBox =
    (await app.$('input[type=search]')) ||
    (await app.$('[role=searchbox]')) ||
    (await controlByLabel(app, /search|find/i))
  if (searchBox) {
    await typeInto(app, searchBox, MARKER)
    await app.keyboard.press('Enter')
    await app
      .waitForFunction(() => /found|match|result/i.test(document.body.innerText), { timeout: 90000 })
      .catch(() => {})
    await delay(200)
    await capture(ctx, app, V, 'search-results')
    await typeInto(app, searchBox, `NOSUCHTEXT${Date.now()}`)
    await app.keyboard.press('Enter')
    await app
      .waitForFunction(() => /found 0|no (logs|match|results)/i.test(document.body.innerText), { timeout: 60000 })
      .catch(() => {})
    await delay(1500)
    await capture(ctx, app, V, 'search-no-results')
    await searchBox.focus()
    await app.keyboard.press('Escape')
    await delay(1500)
  } else summary.errors.push('app: no search box found')

  // Filters.
  const filterBtn = await byName(app, [/^filters?( \(\d+\))?$/i, /filter/i])
  if (filterBtn) {
    await safeClick(filterBtn)
    await delay(800)
    await capture(ctx, app, V, 'filter-dialog')
    const opSelect = await controlByLabel(app, /^operation$/i)
    if (opSelect) {
      await opSelect.click().catch(() => {})
      await delay(600)
      await capture(ctx, app, V, 'filter-dialog-operation-menu')
      await app.keyboard.press('Escape')
      await delay(400)
    }
    await closeDialog(app)
  } else summary.errors.push('app: no filter button found')

  // Appearance (style) panel.
  if (await openAppearance()) {
    await capture(ctx, app, V, 'style-dialog')
    await scrollMain(app, 1)
    await capture(ctx, app, V, 'style-dialog-scrolled')
    await closeDialog(app)
  } else summary.errors.push('app: no appearance panel found')

  // Delete dialog: opened to check it, never confirmed (Escape cancels).
  {
    const item = await menuItem(/^delete logs…$/i)
    if (item) {
      // Opens a confirmation dialog; deleting needs its own button, which the
      // script never clicks.
      await item.click()
      await delay(2500)
      await capture(ctx, app, V, 'delete-dialog')
      if (ctx.primary) {
        const d = await openDialog(app)
        summary.deleteDialog = d
          ? await d.evaluate(el => ({
              text: el.innerText.slice(0, 400),
              focused: document.activeElement && document.activeElement.textContent
            }))
          : null
        if (d) await d.dispose()
      }
      await app.keyboard.press('Escape')
      await delay(600)
      if (await openDialog(app)) {
        const cancel = await byName(app, [/^cancel$/i])
        if (cancel) await safeClick(cancel)
        await delay(500)
      }
    } else summary.errors.push('app: no "Delete logs…" menu item found')
  }

  // Keyboard shortcuts overlay.
  {
    await app.evaluate(() => document.activeElement && document.activeElement.blur())
    const help = await byName(app, [/keyboard shortcuts/i, /help/i])
    if (help) {
      await safeClick(help)
      await delay(700)
      await capture(ctx, app, V, 'help')
      await closeDialog(app)
    }
  }

  if (ctx.primary) {
    const dialogs = []
    for (const [label, patterns] of [
      ['filter', [/^filters?( \(\d+\))?$/i]],
      ['help', [/keyboard shortcuts/i]]
    ]) {
      const trigger = await byName(app, patterns)
      if (trigger) dialogs.push(await dialogKeyboard(app, trigger, label))
      else dialogs.push({ dialog: label, error: 'trigger not found' })
    }
    saveKeyboard(`${V}-keyboard-dialogs`, dialogs)
  }

  // Dark mode list.
  await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await delay(800)
  await capture(ctx, app, V, 'list-dark')
  await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await delay(500)

  // Open the log: click its row (fallback: the route).
  const opened = await app.evaluate(id => {
    const row = document.querySelector(`[data-log-id="${id}"]`)
    if (!row) return false
    row.click()
    return true
  }, logs.main.Id)
  await delay(500)
  if (!(await app.evaluate(id => location.hash.includes(id), logs.main.Id))) {
    if (!opened) summary.errors.push('app: could not open the log by clicking its row')
    await app.evaluate(id => (location.hash = `#/logs/${id}`), logs.main.Id)
  }
  await waitForText(app, `Done ${MARKER}`, 60000)
  await delay(1000)

  // Each palette, via the appearance panel's "Log colors" control.
  const themes = Object.values(logThemes)
  for (const theme of themes) {
    let applied = false
    if (await openAppearance()) {
      const themeControl = await controlByLabel(app, /log colors|theme/i)
      if (themeControl) {
        await chooseOption(app, themeControl, theme.label).then(
          () => (applied = true),
          e => log(`theme ${theme.name}: ${e.message}`)
        )
      }
      await closeDialog(app)
    }
    if (!applied) summary.errors.push(`app: could not switch to theme ${theme.name}`)
    await scrollMain(app, 0)
    await capture(ctx, app, V, `log-${theme.name}`)
    await scrollMain(app, 0.5)
    await capture(ctx, app, V, `log-${theme.name}-scrolled`)
  }
  // Back to the default (light or dark with the color mode).
  if (await openAppearance()) {
    const themeControl = await controlByLabel(app, /log colors|theme/i)
    if (themeControl) await chooseOption(app, themeControl, 'Match app (Light or Dark)').catch(() => {})
    await closeDialog(app)
  }
  await scrollMain(app, 0)

  // Dark mode log.
  await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await delay(800)
  await capture(ctx, app, V, 'log-dark-mode')
  await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await delay(500)

  // Find in the log.
  {
    const find = await controlByLabel(app, /^find in log$/i)
    if (find) {
      await typeInto(app, find, 'iteration')
      await delay(600)
      await app.keyboard.press('Enter')
      await delay(400)
      await capture(ctx, app, V, 'log-find')
      await find.focus()
      await app.keyboard.press('Escape')
      await delay(300)
    } else summary.errors.push('app: no find-in-log field found')
  }

  // Expand the JSON debug line.
  await scrollMain(app, 0)
  const expanded = await app.evaluate(marker => {
    const lines = [...document.querySelectorAll('div, li, [role=row]')].filter(
      d => d.innerText && d.innerText.includes('{"') && d.innerText.includes(marker) && d.innerText.length < 600
    )
    lines.sort((a, b) => a.innerText.length - b.innerText.length)
    const line = lines[0]
    if (!line) return false
    const btn = line.querySelector('button') || line.parentElement.querySelector('button')
    if (!btn) return false
    btn.scrollIntoView({ block: 'center' })
    btn.click()
    return true
  }, MARKER)
  await delay(800)
  if (expanded) await capture(ctx, app, V, 'log-json-expanded')
  else summary.errors.push('app: no expand control on the JSON debug line')

  if (ctx.primary) saveKeyboard(`${V}-keyboard-log`, await tabThrough(app, 'app log view', { maxStops: 40 }))

  // Event types (log content filter).
  const contentFilter = await byName(app, [/^events/i, /filter log content/i, /event/i])
  if (contentFilter) {
    await safeClick(contentFilter)
    await delay(800)
    await capture(ctx, app, V, 'content-filter-dialog')
    await closeDialog(app)
  } else summary.errors.push('app: no event type control found')

  // The log list collapsed to a rail.
  const sideToggle = await byName(app, [/hide log list/i, /side ?list|sidebar|log list|panel/i])
  if (sideToggle) {
    await safeClick(sideToggle)
    await delay(800)
    await capture(ctx, app, V, 'log-side-list-toggled')
    const back = await byName(app, [/show log list/i])
    if (back) await safeClick(back)
    await delay(400)
  }

  // A failed run's log (opens at its first error).
  if (logs.failed) {
    await app.evaluate(id => (location.hash = `#/logs/${id}`), logs.failed.Id)
    await waitForText(app, 'failing run', 30000).catch(() => {})
    await delay(800)
    await capture(ctx, app, V, 'log-failed-run')
  }
  await logSummaryStates(ctx, app, V)
  summary.pageErrors = { ...(summary.pageErrors || {}), [`app@${ctx.size.label}`]: app.errors.map(redact) }
  await app.close()
}

// --- Call tree and timeline (the log viewer's other tabs) -----------------

// The timeline is a canvas, so the DOM contrast check can't see it: count its
// pixel colors and report each frequent color's contrast with the most
// frequent one (the background). Bars and their labels must reach 3:1 and
// 4.5:1 (react/src/ui/contrast.ts).
function canvasColors() {
  const canvas = document.querySelector('[data-testid="timeline-canvas"]')
  if (!canvas || !canvas.width) return { error: 'no timeline canvas' }
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  const counts = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const total = data.length / 4
  const lum = key => {
    const c = [16, 8, 0].map(s => ((key >> s) & 255) / 255)
    const [r, g, b] = c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const hex = key => `#${key.toString(16).padStart(6, '0')}`
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const background = sorted[0][0]
  // Fills: colors covering at least 0.5% of the canvas (anti-aliased text
  // edges are spread over many rare colors).
  const fills = sorted
    .slice(1)
    .filter(([, n]) => n / total >= 0.005)
    .map(([key, n]) => ({ color: hex(key), share: Math.round((n / total) * 1000) / 10, ratio: ratio(key, background) }))
  return {
    background: hex(background),
    fills,
    belowNonText: fills.filter(f => f.ratio < 3)
  }
}

// The tree's ARIA: every item has a level, open/closed state on items with
// children, and the active descendant exists (names: treeItemNames).
function treeAria() {
  const tree = document.querySelector('[role="tree"]')
  if (!tree) return { error: 'no tree' }
  const items = [...tree.querySelectorAll('[role="treeitem"]')]
  const active = tree.getAttribute('aria-activedescendant')
  return {
    items: items.length,
    withoutLevel: items.filter(i => !i.getAttribute('aria-level')).length,
    expandable: items.filter(i => i.hasAttribute('aria-expanded')).length,
    activeDescendantExists: Boolean(active && document.getElementById(active)),
    treeName: tree.getAttribute('aria-label')
  }
}

// Each tree item's accessible name, from the browser's accessibility tree.
async function treeItemNames(page) {
  const names = []
  for (const el of await page.$$('[role="treeitem"]')) {
    const node = await page.accessibility.snapshot({ root: el, interestingOnly: false })
    names.push((node && node.name) || '')
  }
  return names
}

async function clickTab(page, name) {
  const tab = await page.$(`::-p-aria([name="${name}"][role="tab"])`)
  if (!tab) return false
  await tab.click()
  await delay(600)
  return true
}

// The Call tree and Timeline tabs of the open log: default, expanded,
// keyboard, dark mode, hover, zoomed, and a log without units.
async function executionViews(ctx) {
  const V = 'exec'
  const { logs } = ctx
  const page = await newPage(ctx)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.goto(appUrl(ctx) + `#/logs/${logs.main.Id}`, { waitUntil: 'networkidle2' })
  await waitForText(page, `Done ${MARKER}`, 60000)
  await delay(800)

  // Call tree.
  if (!(await clickTab(page, 'Call tree'))) {
    summary.errors.push('exec: no Call tree tab')
    await page.close()
    return
  }
  await page.waitForSelector('[role="tree"]', { timeout: 10000 }).catch(() => {})
  const tree = await capture(ctx, page, V, 'tree')
  tree.treeAria = await page.evaluate(treeAria)
  tree.treeAria.names = await treeItemNames(page)
  tree.treeAria.withoutName = tree.treeAria.names.filter(n => !n.trim()).length
  writeJson(`${V}-tree@${ctx.size.label}.json`, tree)
  summary.states[`${V}-tree@${ctx.size.label}`].treeAria = tree.treeAria
  if (ctx.primary) {
    saveKeyboard(`${V}-keyboard-tree`, await tabThrough(page, 'call tree', { maxStops: 40 }))
    // Arrow keys inside the tree.
    await page.focus('[role="tree"]')
    const activeLabel = async () => {
      const el = await page.evaluateHandle(() => {
        const t = document.querySelector('[role="tree"]')
        return document.getElementById(t.getAttribute('aria-activedescendant'))
      })
      const node = await page.accessibility.snapshot({ root: el, interestingOnly: false })
      const state = await el.evaluate(el => `${el.getAttribute('aria-level')} ${el.getAttribute('aria-expanded')}`)
      return `${state} ${(node && node.name) || ''}`
    }
    const keys = []
    for (const key of ['Home', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'End', 'ArrowLeft']) {
      await page.keyboard.press(key)
      await delay(120)
      keys.push({ key, active: await activeLabel() })
    }
    writeJson(`${V}-keyboard-tree-arrows.json`, keys)
    await capture(ctx, page, V, 'tree-keyboard-focus')
  }
  const expandAll = await byName(page, [/^expand all$/i])
  if (expandAll) {
    await safeClick(expandAll)
    await delay(400)
    await capture(ctx, page, V, 'tree-expanded')
  } else summary.errors.push('exec: no Expand all button')
  // The notice for a log below Apex Code FINE and its "Log methods…" dialog
  // (the Trace flags dialog with the Apex FINEST levels; closed, not started).
  const logMethods = await byName(page, [/^log methods…$/i])
  if (logMethods) {
    await safeClick(logMethods)
    await page.waitForSelector('::-p-aria([name="Trace flags"][role="dialog"])', { visible: true, timeout: 10000 })
    await delay(600)
    await capture(ctx, page, V, 'tree-log-methods-dialog')
    const close = await byName(page, [/^close$/i])
    if (close) await safeClick(close)
    await delay(400)
  } else summary.errors.push('exec: no Log methods… button')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await delay(600)
  await capture(ctx, page, V, 'tree-dark')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await delay(400)

  // Timeline.
  for (const mode of ['light', 'dark']) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode }])
    await clickTab(page, 'Timeline')
    await page.waitForSelector('[data-testid="timeline-canvas"]', { timeout: 10000 }).catch(() => {})
    await delay(400)
    const suffix = mode === 'dark' ? '-dark' : ''
    const result = await capture(ctx, page, V, `timeline${suffix}`)
    result.canvas = await page.evaluate(canvasColors)
    writeJson(`${V}-timeline${suffix}@${ctx.size.label}.json`, result)
    summary.states[`${V}-timeline${suffix}@${ctx.size.label}`].canvasBelowNonText = (
      result.canvas.belowNonText || []
    ).length
    // Hover a bar (level 2, the code unit) for the details card.
    const group = await page.$('::-p-aria([name="Timeline"][role="group"])')
    if (group) {
      const box = await group.boundingBox()
      await page.mouse.move(box.x + box.width / 3, box.y + 22 + 20 + 10)
      await delay(300)
      const hover = await capture(ctx, page, V, `timeline-hover${suffix}`)
      hover.canvas = await page.evaluate(canvasColors)
      writeJson(`${V}-timeline-hover${suffix}@${ctx.size.label}.json`, hover)
      await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5)
    }
    if (mode === 'light') {
      if (ctx.primary) saveKeyboard(`${V}-keyboard-timeline`, await tabThrough(page, 'timeline', { maxStops: 40 }))
      const zoomIn = await byName(page, [/^zoom in/i])
      if (zoomIn) {
        await safeClick(zoomIn)
        await safeClick(zoomIn)
        await delay(400)
        const zoomed = await capture(ctx, page, V, 'timeline-zoomed')
        zoomed.canvas = await page.evaluate(canvasColors)
        writeJson(`${V}-timeline-zoomed@${ctx.size.label}.json`, zoomed)
        const reset = await byName(page, [/^show the whole run/i])
        if (reset) await safeClick(reset)
        await page.mouse.move(1, 1)
      } else summary.errors.push('exec: no Zoom in button')
    }
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  if (ctx.primary) {
    // The ? overlay lists the tree and timeline keys.
    await page.evaluate(() => document.activeElement && document.activeElement.blur())
    await page.keyboard.type('?')
    await delay(600)
    await capture(ctx, page, V, 'shortcuts-overlay', { fullPage: false })
    await closeDialog(page)
  }
  summary.pageErrors = { ...(summary.pageErrors || {}), [`exec@${ctx.size.label}`]: page.errors.map(redact) }
  await page.close()

  // A log without units: the main log's body with only its header and
  // USER_DEBUG lines (served to this page only).
  {
    const empty = await newPage(ctx)
    const body = logs.main.body
      .split('\n')
      .filter(l => !/\|(EXECUTION_|CODE_UNIT_|METHOD_|SYSTEM_METHOD_|SOQL_|DML_|CONSTRUCTOR_)/.test(l))
      .join('\n')
    await empty.setRequestInterception(true)
    empty.on('request', req => {
      if (req.url().includes(`/ApexLog/${logs.main.Id}/Body`))
        req.respond({ status: 200, contentType: 'text/plain', body }).catch(() => {})
      else req.continue().catch(() => {})
    })
    await empty.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await empty.goto(appUrl(ctx) + `#/logs/${logs.main.Id}`, { waitUntil: 'networkidle2' })
    await waitForText(empty, `Done ${MARKER}`, 60000).catch(() => {})
    await delay(600)
    if (await clickTab(empty, 'Call tree')) await capture(ctx, empty, V, 'tree-empty')
    if (await clickTab(empty, 'Timeline')) await capture(ctx, empty, V, 'timeline-empty')
    await empty.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await delay(500)
    await capture(ctx, empty, V, 'timeline-empty-dark')
    await empty.close()
  }
}

// --- The log summary (Errors, Limits, SOQL, DML tabs) ----------------------
// Its states in the main log (exceptions, SOQL, no DML), the limits log (mock
// only: limit levels, loop hints, DML, no errors) and the failed run (fatal
// error, no SOQL), in light and dark mode, plus a jump to a line and the
// keyboard path through the panel.

async function logSummaryStates(ctx, app, V) {
  const { logs } = ctx
  const openLog = async (log, text) => {
    await app.evaluate(id => (location.hash = `#/logs/${id}`), log.Id)
    await waitForText(app, text, 30000).catch(() => {})
    await delay(800)
  }
  const showSummary = async () => {
    if (await app.$('#log-summary')) return true
    const button = await byName(app, [/^summary$/i], { roles: ['button'] })
    if (!button) return false
    await button.click()
    await app.waitForSelector('#log-summary', { visible: true, timeout: 5000 }).catch(() => {})
    return Boolean(await app.$('#log-summary'))
  }
  const tab = async name => {
    const handle = await byName(app, [new RegExp(`^${name}\\b`, 'i')], { within: '#log-summary', roles: ['tab'] })
    if (!handle) {
      summary.errors.push(`app: no ${name} tab in the log summary`)
      return false
    }
    await handle.click()
    await delay(300)
    return true
  }
  const dark = async state => {
    await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await delay(800)
    await capture(ctx, app, V, state)
    await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await delay(500)
  }

  // Main log: caught exceptions, SOQL, no DML.
  await openLog(logs.main, `Done ${MARKER}`)
  if (!(await showSummary())) {
    summary.errors.push('app: the Summary button did not open the log summary')
    return
  }
  await capture(ctx, app, V, 'summary-errors')
  await dark('summary-errors-dark')
  if (await tab('Limits')) await capture(ctx, app, V, 'summary-limits')
  if (await tab('SOQL')) {
    await capture(ctx, app, V, 'summary-soql')
    // Jump to a query's line.
    const query = await app.$('#log-summary tbody tr button')
    if (query) {
      await query.click()
      await delay(800)
      const active = await app.evaluate(() => (document.querySelector('pre > div.is-active') || {}).innerText || '')
      if (!/SOQL_EXECUTE_BEGIN/.test(active)) summary.errors.push('app: the summary did not jump to the query line')
      await capture(ctx, app, V, 'summary-jumped-to-line')
    } else summary.errors.push('app: no query in the summary SOQL tab')
  }
  if (await tab('DML')) await capture(ctx, app, V, 'summary-dml-empty')

  // Keyboard: Summary button, tabs (arrow keys), panel content, Enter jumps.
  if (ctx.primary) {
    const k = {}
    const toggle = await byName(app, [/^hide summary$/i], { roles: ['button'] })
    if (toggle) {
      await toggle.click() // closed, then opened again with the keyboard
      await delay(300)
      const open = await byName(app, [/^summary$/i], { roles: ['button'] })
      await open.focus()
      await app.keyboard.press('Enter')
      await delay(500)
      k.openedWithEnter = Boolean(await app.$('#log-summary'))
      const focusIn = () => app.evaluate(() => document.querySelector('#log-summary')?.contains(document.activeElement))
      const active = () => describeActive(app)
      await app.keyboard.press('Tab')
      await delay(200)
      k.tabReachesTabs = (await active()).role === 'tab' || (await focusIn())
      k.tabsFocus = await active()
      k.tabsFocusVisible = await focusIndicatorVisible(app)
      await app.keyboard.press('ArrowRight')
      await delay(300)
      k.arrowSelects = await app.evaluate(
        () =>
          (document.activeElement.getAttribute('aria-selected') === 'true' && document.activeElement.textContent) ||
          null
      )
      const stops = []
      for (let i = 0; i < 8; i++) {
        await app.keyboard.press('Tab')
        await delay(150)
        const stop = await active()
        stop.inSummary = await focusIn()
        stop.focusIndicatorVisible = await focusIndicatorVisible(app)
        stops.push(stop)
        if (!stop.inSummary) break
      }
      k.stops = stops
      // Enter on an entry jumps to its line (from another line first: the
      // first error) and announces it; focus stays on the entry.
      await tab('Errors')
      const error = await app.$('#log-summary li button')
      if (error) {
        await error.focus()
        await app.keyboard.press('Enter')
        await delay(600)
      }
      await tab('SOQL')
      const button = await app.$('#log-summary tbody tr button')
      if (button) {
        await button.focus()
        await app.keyboard.press('Enter')
        await delay(600)
        k.enterJumps = await app.evaluate(() =>
          /SOQL_EXECUTE_BEGIN/.test((document.querySelector('pre > div.is-active') || {}).innerText || '')
        )
        k.jumpAnnounced = await app.evaluate(
          () => (document.querySelector('#log-summary [role=status]') || {}).textContent || null
        )
        k.focusAfterJump = await active()
      }
    }
    saveKeyboard(`${V}-keyboard-summary`, { tabbableElements: null, stopsRecorded: k.stops?.length, ...k })
  }

  // Limits log (mock only): limits over 70 % and 90 %, loops, DML, no errors.
  if (logs.limits) {
    await openLog(logs.limits, `Limits done ${MARKER}`)
    if (await showSummary()) {
      await tab('Limits')
      await capture(ctx, app, V, 'summary-limit-levels')
      await dark('summary-limit-levels-dark')
      if (await tab('Errors')) await capture(ctx, app, V, 'summary-errors-empty')
      if (await tab('SOQL')) {
        await capture(ctx, app, V, 'summary-soql-loop')
        await dark('summary-soql-loop-dark')
      }
      if (await tab('DML')) {
        await capture(ctx, app, V, 'summary-dml')
        await dark('summary-dml-dark')
      }
    }
  }

  // Failed run: a fatal error, no SOQL.
  if (logs.failed) {
    await openLog(logs.failed, 'failing run')
    if (await showSummary()) {
      await tab('Errors')
      await capture(ctx, app, V, 'summary-fatal-error')
      if (await tab('SOQL')) await capture(ctx, app, V, 'summary-soql-empty')
    }
  }
  const hide = await byName(app, [/^hide summary$/i], { roles: ['button'] })
  if (hide) await hide.click()
}

// --- Classic Salesforce pages enhanced by content scripts -----------------

const CLASSIC_LOG_SCOPE = [
  '#apexdbgToolbar',
  'pre.apexdbg-log',
  '#debugText',
  '#controllersContainer',
  '#selectStyleContainer',
  '#selectFontContainer',
  '.toggleHidden',
  '#collapseAllButton',
  '#hintContainer'
]
const CLASSIC_LIST_SCOPE = [
  '.apexdbg-list-tools',
  '.apexdbg-search',
  '.apexdbg-inline-tools',
  '#apexdbgDeleteDialog',
  'tr.apexdbg-match',
  '#real_delete_all',
  '#load_new_logs',
  '#add_current_user',
  '#FilterByText',
  'form[target=remember]',
  'label:has(input[type=number])',
  'tr[data-id]',
  'tr[style*="104, 170, 87"]' // rows the search highlights
]
const CLASS_PAGE_SCOPE = [
  '.apexdbg-dont-log',
  '.apexdbg-inline-tools',
  '.dontLog',
  '.headerRow th:last-child',
  'input[value^="See All"]'
]

async function classicViews(ctx) {
  const V = 'classic'
  const { logs } = ctx

  // Log detail page.
  {
    const page = await newPage(ctx)
    await gotoSalesforce(ctx, page, `/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${logs.main.Id}`)
    await page.waitForFunction(m => document.body.innerText.includes(m), { timeout: 30000 }, `Done ${MARKER}`)
    await delay(1500)
    const themeSelect = await controlByLabel(page, /log colors|style|theme/i)
    for (const theme of Object.values(logThemes)) {
      if (themeSelect)
        await chooseOption(page, themeSelect, theme.label).catch(e =>
          summary.errors.push(`classic theme ${theme.name}: ${e.message}`)
        )
      else summary.errors.push('classic: no theme select found')
      await page.evaluate(() => window.scrollTo(0, 0))
      await capture(ctx, page, V, `log-${theme.name}`, { scope: CLASSIC_LOG_SCOPE })
      await scrollMain(page, 0.5)
      await capture(ctx, page, V, `log-${theme.name}-scrolled`, { scope: CLASSIC_LOG_SCOPE })
    }
    if (themeSelect) await chooseOption(page, themeSelect, Object.values(logThemes)[0].label).catch(() => {})
    await page.evaluate(() => window.scrollTo(0, 0))
    // The page in dark mode (the toolbar and "Match color mode" follow it).
    if (themeSelect) await chooseOption(page, themeSelect, 'Match color mode').catch(() => {})
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await delay(500)
    await capture(ctx, page, V, 'log-dark-mode', { scope: CLASSIC_LOG_SCOPE })
    await scrollMain(page, 0.5)
    await capture(ctx, page, V, 'log-dark-mode-scrolled', { scope: CLASSIC_LOG_SCOPE })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await page.evaluate(() => window.scrollTo(0, 0))
    // The page's shortcuts list.
    const shortcuts = await byName(page, [/^shortcuts$/i])
    if (shortcuts) {
      await safeClick(shortcuts)
      await delay(300)
      await capture(ctx, page, V, 'log-shortcuts', { scope: CLASSIC_LOG_SCOPE })
      await page.keyboard.press('Escape')
    }
    const expandAll = await byName(page, [/expand all/i])
    if (expandAll) {
      await safeClick(expandAll)
      await delay(1500)
      await page.evaluate(m => {
        const el = [...document.querySelectorAll('#debugText div, pre div')].find(
          d => d.textContent.includes('"marker"') && d.textContent.includes(m)
        )
        if (el) el.scrollIntoView({ block: 'center' })
      }, MARKER)
      await capture(ctx, page, V, 'log-expanded', { scope: CLASSIC_LOG_SCOPE })
      await page.evaluate(() => window.scrollTo(0, 0))
    }
    if (ctx.primary) saveKeyboard(`${V}-keyboard-log`, await tabThrough(page, 'classic log detail', { maxStops: 50 }))
    await page.close()
  }

  // Log list page with the extension's buttons.
  {
    const page = await newPage(ctx)
    await gotoSalesforce(ctx, page, '/setup/ui/listApexTraces.apexp')
    await waitForText(page, 'Load New Logs', 30000).catch(() => {})
    await delay(1500)
    await capture(ctx, page, V, 'list', { scope: CLASSIC_LIST_SCOPE })
    // Search: the box is filled by script and submitted, without typing
    // (the page binds single-letter hotkeys).
    const box = (await page.$('#FilterByText')) || (await controlByLabel(page, /search/i))
    if (box) {
      await box.evaluate((el, text) => {
        el.value = text
        const form = el.form
        if (form && form.requestSubmit) form.requestSubmit()
        else if (form) form.dispatchEvent(new Event('submit', { cancelable: true }))
      }, MARKER)
      await page
        .waitForFunction(
          () => /contain/.test((document.getElementById('apexdbgSearchStatus') || {}).textContent || ''),
          {
            timeout: 60000
          }
        )
        .catch(() => delay(8000))
      await capture(ctx, page, V, 'list-search', { scope: CLASSIC_LIST_SCOPE })
    }
    // Delete dialog: opened to check it, never confirmed (Escape cancels).
    const deleteButton = await page.$('#real_delete_all')
    if (deleteButton) {
      await deleteButton.click()
      await page
        .waitForFunction(() => /Only my logs \(\d/.test(document.body.innerText), { timeout: 30000 })
        .catch(() => {})
      await capture(ctx, page, V, 'list-delete-dialog', { scope: CLASSIC_LIST_SCOPE })
      await page.keyboard.press('Escape')
      await delay(400)
    }
    if (ctx.primary) saveKeyboard(`${V}-keyboard-list`, await tabThrough(page, 'classic log list', { maxStops: 60 }))
    await page.close()
  }

  // Apex class list.
  {
    const page = await newPage(ctx)
    await gotoSalesforce(ctx, page, '/01p')
    await delay(2500)
    await capture(ctx, page, V, 'class-list', { scope: CLASS_PAGE_SCOPE })
    await page.close()
  }
}

// --- Trace flags dialog (app, "Trace flags…") -----------------------------

// The trace flags dialog's own UI: the dialog and the popups it opens.
const TRACE_SCOPE = ['[role=dialog]', '[role=listbox]', '[role=presentation] [role=listbox]']

// Captures the Trace flags dialog: loading, its read error, open (active
// flags), each target picker with search results, no matches and a search
// error, the custom levels editor (scrolled to the end), a start error, and
// filled (after tracing another user and a class). Starting and stopping
// traces only happens on the mock org; against a real org the view only
// opens the dialog and reads.
async function traceFlagsView(ctx) {
  const V = 'trace'
  const page = await newPage(ctx)
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ])
  // Requests matching a rule are failed with a Salesforce-style error.
  const failing = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = decodeURIComponent(req.url())
    const rule = failing.find(r => r.method === req.method() && r.match.test(url))
    if (!rule) return req.continue().catch(() => {})
    req
      .respond({
        status: rule.status || 500,
        contentType: 'application/json',
        body: JSON.stringify([{ errorCode: rule.code || 'UNKNOWN_EXCEPTION', message: rule.message }])
      })
      .catch(() => {})
  })
  await page.goto(appUrl(ctx), { waitUntil: 'networkidle2' })
  await delay(1000)
  const DIALOG = '[role=dialog]'
  const open = async () => {
    let trigger = await byName(page, [/^trace flags…$/i], { roles: ['button'] })
    if (!trigger) {
      const status = await byName(page, [/^logging on/i], { roles: ['button'] })
      if (!status) throw new Error('no logging control')
      await safeClick(status)
      await delay(500)
      trigger = await byName(page, [/^trace flags…/i], { roles: ['menuitem'] })
    }
    if (!trigger) throw new Error('no "Trace flags…" control')
    await safeClick(trigger)
    await page.waitForSelector(DIALOG, { visible: true, timeout: 10000 })
    await delay(300)
  }
  const waitIdle = () =>
    page
      .waitForFunction(
        sel => !/Loading trace flags|Starting the trace|Stopping/.test(document.querySelector(sel)?.innerText || ''),
        { timeout: 15000 },
        DIALOG
      )
      .catch(() => {})
  const close = async () => {
    await page.keyboard.press('Escape')
    await page.waitForSelector(DIALOG, { hidden: true, timeout: 5000 }).catch(() => {})
    await delay(300)
  }
  const combobox = label => page.$(`${DIALOG} ::-p-aria([name="${label}"][role="combobox"])`)
  const choose = async (label, text) => {
    const control = await combobox(label)
    if (!control) throw new Error(`no ${label} field`)
    await chooseOption(page, control, text)
    await page.waitForSelector('[role=listbox]', { hidden: true, timeout: 5000 }).catch(() => {})
  }
  const search = async (label, term) => {
    const input = await combobox(label)
    if (!input) throw new Error(`no ${label} search`)
    await typeInto(page, input, term)
    await delay(1200) // debounce plus the query
  }
  const scrollDialog = fraction =>
    page.evaluate(fraction => {
      const el =
        document.querySelector('[role=dialog] .MuiDialogContent-root') || document.querySelector('[role=dialog]')
      el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
    }, fraction)
  // Opens the dialog with the keyboard ("Trace flags…" button, or the
  // logging menu's item), then checks focus moves in, Tab stays in, and
  // Escape returns focus to the header's control.
  const traceKeyboard = async () => {
    const direct = await byName(page, [/^trace flags…$/i], { roles: ['button'] })
    const status = direct ? null : await byName(page, [/^logging on/i], { roles: ['button'] })
    const trigger = direct || status
    if (!trigger) return { dialog: 'trace flags', error: 'trigger not found' }
    if (direct) return dialogKeyboard(page, direct, 'trace flags')
    const result = { dialog: 'trace flags (from the logging menu)' }
    await status.focus()
    await page.keyboard.press('Enter')
    await delay(500)
    for (let i = 0; i < 6; i++) {
      const name = await page.evaluate(() => document.activeElement?.innerText || '')
      if (/^Trace flags…/.test(name)) break
      await page.keyboard.press('ArrowDown')
      await delay(100)
    }
    await page.keyboard.press('Enter')
    await page.waitForSelector(DIALOG, { visible: true, timeout: 10000 }).catch(() => {})
    await delay(600)
    const dialog = await openDialog(page)
    result.opened = Boolean(dialog)
    if (!dialog) return result
    result.focusMovedIntoDialog = await dialog.evaluate(d => d.contains(document.activeElement))
    const outside = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      await delay(100)
      if (!(await dialog.evaluate(d => d.contains(document.activeElement)))) {
        const stop = await describeActive(page)
        outside.push(stop.body ? 'body' : `${stop.element} "${stop.name}"`)
      }
    }
    result.tabStaysInDialog = outside.length === 0
    result.tabStopsOutsideDialog = outside
    await page.keyboard.press('Escape')
    await delay(700)
    result.closedWithEscape = !(await openDialog(page))
    result.focusReturnedToTrigger = await status.evaluate(el => document.activeElement === el)
    result.focusAfterClose = await describeActive(page)
    await dialog.dispose()
    return result
  }
  const shot = (state, opts = {}) => capture(ctx, page, V, state, { scope: TRACE_SCOPE, ...opts })

  try {
    // Read error: the active flags query fails.
    failing.push({ method: 'GET', match: /FROM TraceFlag/, message: 'Simulated failure (ux audit)' })
    await open()
    await waitIdle()
    await shot('load-error')
    failing.length = 0
    await close()

    await open()
    await waitIdle()
    await shot('open')
    if (ctx.primary) {
      await close()
      saveKeyboard(`${V}-keyboard-dialog`, [await traceKeyboard()])
      await open()
      await waitIdle()
    }
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await delay(500)
    await shot('open-dark')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await delay(300)

    // Target menu, then "Another user" with nothing picked (Start disabled).
    const target = await combobox('Trace')
    if (target) {
      await target.click()
      await delay(400)
      await shot('target-menu')
      await page.keyboard.press('Escape')
      await delay(300)
    }
    await choose('Trace', 'Another user')
    await shot('user-not-picked')
    // Start with no user picked: the field says what's missing.
    await safeClick(await byName(page, [/^start tracing$/i], { within: DIALOG, roles: ['button'] }))
    await delay(300)
    await shot('user-missing')
    await search('User', 'd')
    await shot('user-search-short')
    await search('User', 'dev')
    await shot('user-search-results')
    await search('User', 'zzzz')
    await shot('user-search-no-matches')
    failing.push({ method: 'GET', match: /FROM User/, message: 'Simulated failure (ux audit)' })
    await search('User', 'other')
    await delay(500)
    await shot('user-search-error')
    failing.length = 0

    await choose('Trace', 'An Apex class or trigger')
    await search('Apex class or trigger', 'lead')
    await shot('code-search-results')
    await page.keyboard.press('Escape')
    await delay(200)

    await choose('Debug level', 'Custom levels…')
    await shot('custom-levels')
    await scrollDialog(1)
    await shot('custom-levels-scrolled')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await delay(500)
    await shot('custom-levels-dark')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await delay(300)
    await close()

    if (ctx.session && args.mock) {
      // Start error: Salesforce refuses the new flag.
      await open()
      await waitIdle()
      await choose('Trace', 'Automated Process')
      failing.push({
        method: 'POST',
        match: /sobjects\/TraceFlag/,
        status: 400,
        code: 'FIELD_INTEGRITY_EXCEPTION',
        message: 'Simulated failure (ux audit)'
      })
      failing.push({
        method: 'PATCH',
        match: /sobjects\/TraceFlag/,
        status: 400,
        message: 'Simulated failure (ux audit)'
      })
      const start = await byName(page, [/^start tracing$/i], { within: DIALOG, roles: ['button'] })
      await safeClick(start)
      await page.waitForSelector(`${DIALOG} [role=alert]`, { timeout: 10000 }).catch(() => {})
      await waitIdle()
      await scrollDialog(1)
      await shot('start-error')
      failing.length = 0

      // Filled: trace another user and a class (mock org only), then stop them.
      await choose('Trace', 'Another user')
      await search('User', 'other')
      const option = await page.waitForSelector(
        '::-p-xpath(//li[@role="option" and .//*[normalize-space()="Other Developer"]])',
        {
          visible: true,
          timeout: 10000
        }
      )
      await option.click()
      await delay(300)
      await safeClick(await byName(page, [/^start tracing$/i], { within: DIALOG, roles: ['button'] }))
      await waitIdle()
      await choose('Trace', 'An Apex class or trigger')
      await search('Apex class or trigger', 'invoice')
      const cls = await page.waitForSelector(
        '::-p-xpath(//li[@role="option" and .//*[normalize-space()="InvoiceBatch"]])',
        {
          visible: true,
          timeout: 10000
        }
      )
      await cls.click()
      await delay(300)
      await safeClick(await byName(page, [/^start tracing$/i], { within: DIALOG, roles: ['button'] }))
      await waitIdle()
      await delay(500)
      await scrollDialog(0)
      await shot('filled')
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
      await delay(500)
      await shot('filled-dark')
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
      for (const name of ['Other Developer', 'InvoiceBatch']) {
        const stop = await page.$(`${DIALOG} ::-p-aria([name="Stop tracing ${name}"][role="button"])`)
        if (stop) {
          await stop.click()
          await waitIdle()
          await delay(500)
        }
      }
      await close()
    }
  } finally {
    summary.pageErrors = { ...(summary.pageErrors || {}), [`trace@${ctx.size.label}`]: page.errors.map(redact) }
    await page.close()
  }
}

// --- Options page ----------------------------------------------------------

async function optionsView(ctx) {
  const V = 'options'
  const page = await newPage(ctx)
  await page.goto(`chrome-extension://${ctx.ext.extensionId}/html/options.html`, { waitUntil: 'networkidle2' })
  await delay(800)
  await capture(ctx, page, V, 'default', { fullPage: true })
  if (ctx.primary) saveKeyboard(`${V}-keyboard`, await tabThrough(page, 'options', { maxStops: 80 }))
  // Restore defaults asks first; the script cancels.
  const restore = await byName(page, [/^restore defaults/i])
  if (restore) {
    await safeClick(restore)
    await delay(500)
    await capture(ctx, page, V, 'restore-confirm')
    await page.keyboard.press('Escape')
    await delay(400)
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await delay(400)
  await capture(ctx, page, V, 'dark', { fullPage: true })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  const add = await byName(page, [/add new/i, /add shortcut/i, /^add$/i])
  if (add) {
    await safeClick(add)
    await delay(500)
    await capture(ctx, page, V, 'new-row', { fullPage: true })
    // Save with the new row still empty: the validation feedback.
    const save = await byName(page, [/^save$/i, /^save shortcuts$/i, /save/i])
    if (save) {
      const before = page.url()
      await safeClick(save)
      await delay(300)
      await capture(ctx, page, V, 'save-invalid', { fullPage: true })
      summary.optionsSaveInvalidNavigated = page.url() !== before
    }
  }
  await page.close()
}

// ---------------------------------------------------------------------------

function compareWith(previousDir) {
  const file = join(resolve(previousDir), 'summary.json')
  if (!existsSync(file)) return log(`no ${file} to compare with`)
  const prev = JSON.parse(readFileSync(file, 'utf8'))
  const keys = [
    'axe',
    'contrastElements',
    'nonTextContrast',
    'unnamedControls',
    'clickableNotFocusable',
    'smallText',
    'clippedText',
    'obscuredControls'
  ]
  const total = s =>
    Object.fromEntries(keys.map(k => [k, Object.values(s.states).reduce((n, st) => n + (st[k] || 0), 0)]))
  const before = total(prev)
  const after = total(summary)
  summary.comparison = { previous: previousDir, before, after }
  console.log('\nCompared with', previousDir)
  for (const k of keys) console.log(`  ${k.padEnd(24)} ${String(before[k]).padStart(6)} -> ${after[k]}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const run = await startRun({ mock: args.mock })
  summary.mock = Boolean(run.mock)
  const sf = run.sf
  SESSION_ID = run.session.sessionId
  const logs = await produceLogs(sf, { mock: run.mock })
  // produceLogs renews a reused session that had expired.
  const session = run.session
  SESSION_ID = session.sessionId
  const ext = await run.launch()
  try {
    for (const [i, size] of SIZES.entries()) {
      const ctx = { ext, session, sf, logs, size, primary: i === 0 }
      for (const view of VIEWS) {
        const fn = {
          app: appView,
          classic: classicViews,
          options: optionsView,
          exec: executionViews,
          trace: traceFlagsView
        }[view]
        if (!fn) throw new Error(`unknown view ${view}`)
        log(`--- ${view} @ ${size.label}`)
        try {
          await fn(ctx)
        } catch (e) {
          log(`${view}@${size.label} failed: ${e.stack}`)
          summary.errors.push(`${view}@${size.label}: ${redact(e.message)}`)
          for (const p of await ext.browser.pages()) {
            if (p.url().startsWith('about:blank')) continue
            await p.screenshot({ path: join(OUT, `error-${view}@${size.label}.png`) }).catch(() => {})
            await p.close().catch(() => {})
          }
        }
      }
    }
  } finally {
    summary.requests = run.report('Salesforce requests of this audit')
    await run.close()
  }
  summary.finishedAt = new Date().toISOString()
  if (args.compare) compareWith(args.compare)
  writeJson('summary.json', summary)
  log(`done: ${Object.keys(summary.states).length} states in ${OUT}`)
  if (summary.errors.length) log(`problems:\n  ${summary.errors.join('\n  ')}`)
}

main().catch(e => {
  console.error(redact(e.stack))
  process.exit(1)
})

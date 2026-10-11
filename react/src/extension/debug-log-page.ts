// Content script on the classic single-log page (ApexDebugLogDetailEdit):
// colors and indents the log with the log palettes (core/log/themes.ts,
// applied through css/debug.css), and adds a sticky toolbar: palette, font
// size, wrapping, which entries to show, timestamps, expand all, open in Apex
// Debugger and the page's keyboard shortcuts. Record ids become links, and
// USER_DEBUG values (HTML, JSON, Apex objects) and callout requests and
// responses (core/log/callouts.ts) can be expanded.
//
// The toolbar and the log use the design tokens (classic-ui.ts) and follow the
// user's color mode, like the app (docs/ux/baseline-review.md M10, M14, B6).
import Mousetrap from 'mousetrap'
import {
  getSession,
  openAppMessage,
  pageSalesforce,
  parseDiscoCookie
} from '../core/page-session'
import { logToBlocks, type LogBlock } from '../core/log/classic-blocks'
import { splitIds } from '../core/log/parsing'
import {
  canExpandValue,
  expandValue,
  splitValue,
  type ValueKind
} from '../core/log/values'
import {
  AUTO_THEME,
  logThemes,
  paletteFor,
  resolveThemeName,
  themeCssVariables
} from '../core/log/themes'
import { cached } from '../core/cached'
import { CLASSIC_LOG_PAGE_SHORTCUTS } from '../core/page-shortcuts'
import {
  checkbox,
  followColorMode,
  h,
  injectDesignTokens,
  keysElement,
  pageShortcutSettings,
  pageStorage,
  select
} from './classic-ui'

// Log text is untrusted (System.debug of a public Site's input, record data):
// it only ever reaches the page as text nodes, never as HTML.

// Settings, in the Salesforce page's localStorage (kept from earlier
// versions: style, fontSize, showTimeStamp).
const SETTINGS = {
  theme: 'style',
  fontSize: 'fontSize',
  timestamps: 'showTimeStamp',
  wrap: 'apexDebugger.wrap',
  systemMethods: 'apexDebugger.showSystemMethods',
  userMethods: 'apexDebugger.showUserMethods'
}
const KEY_PREFIXES_CACHE = 'apexDebugger.keyPrefixes'
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_FONT_SIZE = 14

const readBool = (key: string, fallback: boolean) => {
  const value = pageStorage.get(key)
  return value === null ? fallback : value === 'true'
}

let keyPrefixes: string[] = []
let rawLog = ''
let colorMode: 'light' | 'dark' = 'light'
const state = {
  theme: pageStorage.get(SETTINGS.theme) || AUTO_THEME,
  fontSize: Number(pageStorage.get(SETTINGS.fontSize)) || DEFAULT_FONT_SIZE,
  timestamps: readBool(SETTINGS.timestamps, false),
  wrap: readBool(SETTINGS.wrap, true),
  systemMethods: readBool(SETTINGS.systemMethods, false),
  userMethods: readBool(SETTINGS.userMethods, true),
  expanded: false
}

let logBox: HTMLElement
let debugText: HTMLElement
let expandAllButton: HTMLButtonElement

function init() {
  const codeBlock = document.querySelector('pre')
  if (!codeBlock) return
  injectDesignTokens()
  rawLog = codeBlock.textContent
  debugText = h('div', { id: 'debugText' })
  logBox = codeBlock
  logBox.classList.add('ad-root', 'ad-log')
  logBox.setAttribute('role', 'region')
  logBox.setAttribute('aria-label', 'Debug log')
  logBox.tabIndex = 0
  logBox.replaceChildren(debugText)
  const oLeft = document.querySelector<HTMLElement>('.oLeft')
  if (oLeft) oLeft.style.display = 'none'
  const oRight = document.querySelector('.oRight') || logBox.parentElement
  const toolbar = buildToolbar()
  oRight.insertBefore(logBox, oRight.firstChild)
  oRight.insertBefore(toolbar, logBox)
  followColorMode(toolbar)
  followColorMode(logBox, mode => {
    colorMode = mode
    applyTheme()
  })
  applySettings()
  renderLog()
  loadKeyPrefixes()
  bindShortcuts()
}

// Applies everything but the palette and the log's content.
function applySettings() {
  debugText.style.fontSize = `${state.fontSize}px`
  logBox.classList.toggle('ad-wrap', state.wrap)
  logBox.classList.toggle('ad-show-system', state.systemMethods)
  logBox.classList.toggle('ad-hide-user', !state.userMethods)
}

// Sets the palette's colors and fonts as CSS custom properties, which the
// rules in css/debug.css apply to each category's class. #debugText's class
// is the palette's name. "Match color mode" picks light or dark.
function applyTheme() {
  const theme =
    state.theme === AUTO_THEME
      ? paletteFor(AUTO_THEME, colorMode)
      : logThemes[resolveThemeName(state.theme)]
  debugText.className = theme.name
  for (const [property, value] of Object.entries(themeCssVariables(theme))) {
    logBox.style.setProperty(property, value)
    debugText.style.setProperty(property, value)
  }
}

function setSetting<K extends keyof typeof state>(
  key: K,
  value: (typeof state)[K]
) {
  state[key] = value
  if (key in SETTINGS)
    pageStorage.set(SETTINGS[key as keyof typeof SETTINGS], String(value))
}

function buildToolbar(): HTMLElement {
  const themeOptions = [
    { value: AUTO_THEME, label: 'Match color mode' },
    ...Object.values(logThemes).map(t => ({ value: t.name, label: t.label }))
  ]
  const themeValue =
    state.theme === AUTO_THEME ? AUTO_THEME : resolveThemeName(state.theme)
  const sizes = Array.from({ length: 17 }, (_, i) => String(12 + i))
  if (!sizes.includes(String(state.fontSize)))
    state.fontSize = DEFAULT_FONT_SIZE
  expandAllButton = h('button', {
    type: 'button',
    id: 'collapseAllButton',
    className: 'ad-button',
    text: 'Expand all values',
    onclick: toggleExpandAll
  })
  expandAllButton.setAttribute('aria-keyshortcuts', 'E')
  const shortcutsPanel = h('div', {
    id: 'adShortcutsPanel',
    className: 'ad-popover',
    hidden: true
  })
  const shortcutsButton = h('button', {
    type: 'button',
    className: 'ad-button',
    text: 'Shortcuts',
    attrs: { 'aria-expanded': 'false', 'aria-controls': 'adShortcutsPanel' }
  })
  const setOpen = (open: boolean) => {
    shortcutsPanel.hidden = !open
    shortcutsButton.setAttribute('aria-expanded', String(open))
  }
  shortcutsButton.addEventListener('click', () =>
    setOpen(shortcutsPanel.hidden === true)
  )
  // Escape (on the button or in the panel) and a click elsewhere close it.
  const anchor = h(
    'span',
    { className: 'ad-popover-anchor' },
    shortcutsButton,
    shortcutsPanel
  )
  anchor.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !shortcutsPanel.hidden) {
      setOpen(false)
      shortcutsButton.focus()
    }
  })
  document.addEventListener('click', event => {
    if (!anchor.contains(event.target as Node)) setOpen(false)
  })
  fillShortcutsPanel(shortcutsPanel, true)
  return h(
    'div',
    {
      id: 'adToolbar',
      className: 'ad-root ad-toolbar',
      attrs: { role: 'region', 'aria-label': 'Apex Debugger log tools' }
    },
    h(
      'div',
      { className: 'ad-toolbar-row' },
      select('styleSelection', 'Log colors', themeOptions, themeValue, v => {
        setSetting('theme', v)
        applyTheme()
      }),
      select(
        'fontSelection',
        'Font size',
        sizes.map(s => ({ value: s, label: `${s} px` })),
        String(state.fontSize),
        v => {
          setSetting('fontSize', Number(v))
          applySettings()
        }
      ),
      checkbox(
        'wrapLines',
        'Wrap lines',
        state.wrap,
        v => {
          setSetting('wrap', v)
          applySettings()
        },
        'W'
      ),
      h('span', {
        className: 'ad-separator',
        attrs: { 'aria-hidden': 'true' }
      }),
      checkbox(
        'showUserMethod',
        'User methods',
        state.userMethods,
        v => {
          setSetting('userMethods', v)
          applySettings()
        },
        'U'
      ),
      checkbox(
        'showSystem',
        'System methods',
        state.systemMethods,
        v => {
          setSetting('systemMethods', v)
          applySettings()
        },
        'S'
      ),
      checkbox(
        'showTimestamps',
        'Timestamps',
        state.timestamps,
        v => {
          setSetting('timestamps', v)
          renderLog()
        },
        'T'
      ),
      h('span', { className: 'ad-spacer' }),
      expandAllButton,
      h('button', {
        type: 'button',
        className: 'ad-button ad-button-primary',
        text: 'Open in Apex Debugger',
        onclick: openInApp
      }),
      anchor
    )
  )
}

function fillShortcutsPanel(panel: HTMLElement, enabled: boolean) {
  const heading = h('p', {
    className: 'ad-popover-title',
    text: 'Keyboard shortcuts on this page'
  })
  if (!enabled) {
    panel.replaceChildren(
      heading,
      h('p', {
        text: 'Page shortcuts are turned off in the extension options.'
      })
    )
    return
  }
  panel.replaceChildren(
    heading,
    h(
      'dl',
      {},
      ...CLASSIC_LOG_PAGE_SHORTCUTS.flatMap(s => [
        h('dt', {}, keysElement(s.keys)),
        h('dd', { text: s.description })
      ])
    ),
    h('p', {
      className: 'ad-muted',
      text: 'They work while no field has focus. Change or turn off shortcuts in the extension options.'
    })
  )
}

// The log, as one div per entry. Rebuilt when timestamps are turned on or
// off; expanded values collapse again.
function renderLog() {
  const nodes: Node[] = []
  for (const block of logToBlocks(rawLog, state.timestamps)) {
    nodes.push(...renderBlock(block))
  }
  debugText.replaceChildren(...nodes)
  state.expanded = false
  updateExpandAllButton()
  const valueDivs = [...debugText.querySelectorAll('.debug, .callout')]
  // In slices, so a long log shows before every value is checked.
  const step = (start: number) => {
    valueDivs
      .slice(start, start + 500)
      .forEach(div => addExpandButton(div as HTMLElement))
    if (start + 500 < valueDivs.length) setTimeout(() => step(start + 500))
  }
  setTimeout(() => step(0))
}

function updateExpandAllButton() {
  expandAllButton.textContent = state.expanded
    ? 'Collapse all values'
    : 'Expand all values'
}

function toggleExpandAll() {
  const expand = !state.expanded
  const selector = expand
    ? '.expandUserDebugBtn.collapsed'
    : '.expandUserDebugBtn.expanded'
  debugText
    .querySelectorAll<HTMLButtonElement>(selector)
    .forEach(button => toggleValue(button))
  state.expanded = expand
  updateExpandAllButton()
}

async function openInApp() {
  const { orgId, userId } = parseDiscoCookie()
  const session = await getSession()
  const logId = new URLSearchParams(location.search).get('apex_log_id')
  const message = openAppMessage(orgId, userId, session)
  if (logId && /^[a-zA-Z0-9]{15,18}$/.test(logId)) {
    message.url += `#/logs/${logId}`
  }
  chrome.runtime.sendMessage(message)
}

async function bindShortcuts() {
  const settings = await pageShortcutSettings()
  const enabled = !settings || settings.enabled
  fillShortcutsPanel(document.getElementById('adShortcutsPanel'), enabled)
  if (!enabled) return
  const click = (id: string) => () => {
    document.getElementById(id).click()
    return false
  }
  const handlers: Record<string, () => boolean> = {
    toggleSystem: click('showSystem'),
    toggleUser: click('showUserMethod'),
    toggleTimestamps: click('showTimestamps'),
    toggleExpand: click('collapseAllButton'),
    toggleWrap: click('wrapLines')
  }
  for (const shortcut of CLASSIC_LOG_PAGE_SHORTCUTS) {
    if (handlers[shortcut.id])
      Mousetrap.bind(shortcut.keys, handlers[shortcut.id])
  }
}

// Text with each Salesforce id as a link. legalOnly: other ids stay text;
// otherwise every id is linked and ids of unknown objects are disabled once
// the org's key prefixes are known (see loadKeyPrefixes).
function withIdLinks(text: string, legalOnly = false): Node[] {
  return splitIds(text).map(part => {
    if (typeof part === 'string') return document.createTextNode(part)
    const legal = isLegalId(part.id)
    if (legalOnly && !legal) return document.createTextNode(part.id)
    if (keyPrefixes.length && !legal) return document.createTextNode(part.id)
    const link = document.createElement('a')
    link.href = '/' + part.id
    link.className = 'idLink'
    link.textContent = part.id
    return link
  })
}

function renderBlock(block: LogBlock): Node[] {
  const nodes = block.parts.flatMap(part =>
    typeof part === 'string' ? withIdLinks(part) : renderBlock(part)
  )
  if (block.className === null) return nodes
  const div = document.createElement('div')
  div.className = block.className
  div.append(...nodes)
  return [div]
}

function span(className: string, text: string) {
  const element = document.createElement('span')
  element.className = className
  element.append(...withIdLinks(text))
  return element
}

// A USER_DEBUG or callout entry: header and value in spans, and an expand
// button if expanding changes how the value reads.
function addExpandButton(entryDiv: HTMLElement) {
  const value = splitValue(entryDiv.textContent)
  if (!value) return
  const content = span('debugContent searchable', value.message)
  content.dataset.kind = value.kind
  entryDiv.replaceChildren(
    span('debugHeader searchable', value.header),
    ' ',
    content
  )
  if (canExpandValue(value.kind, value.message)) {
    const button = h('button', {
      type: 'button',
      className: 'expandUserDebugBtn collapsed',
      text: '+',
      attrs: { 'aria-expanded': 'false', 'aria-label': 'Expand value' }
    })
    button.addEventListener('click', () => toggleValue(button))
    entryDiv.insertBefore(button, entryDiv.firstChild)
  }
}

// The collapsed content of each expanded value, to restore it.
const collapsedContent = new WeakMap<Element, Node[]>()

function toggleValue(button: HTMLButtonElement) {
  const content =
    button.parentElement.querySelector<HTMLElement>('.debugContent')
  if (!content) return
  const kind = content.dataset.kind as ValueKind
  if (button.classList.contains('collapsed')) {
    collapsedContent.set(content, [...content.childNodes])
    content.replaceChildren(
      ...withIdLinks(expandValue(kind, content.textContent), true)
    )
    button.classList.replace('collapsed', 'expanded')
    button.textContent = '−'
    button.setAttribute('aria-expanded', 'true')
    button.setAttribute('aria-label', 'Collapse value')
  } else {
    content.replaceChildren(...(collapsedContent.get(content) || []))
    button.classList.replace('expanded', 'collapsed')
    button.textContent = '+'
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-label', 'Expand value')
  }
}

// The org's key prefixes tell record ids from other 15/18-character words.
// They rarely change: cached for a day per org (one API call instead of one
// per page view).
function loadKeyPrefixes() {
  let storage: Storage | undefined
  try {
    storage = localStorage
  } catch {
    storage = undefined
  }
  cached(storage, KEY_PREFIXES_CACHE, DAY_MS, () =>
    pageSalesforce().keyPrefixes()
  )
    .then(prefixes => {
      keyPrefixes = [...prefixes, '03d'] // 03d: validation rule
      debugText.querySelectorAll('a.idLink').forEach(link => {
        if (!isLegalId(link.textContent)) {
          link.replaceWith(document.createTextNode(link.textContent))
        }
      })
    })
    .catch(err => console.error('Apex Debugger: reading key prefixes', err))
}

function isLegalId(id: string) {
  return keyPrefixes.indexOf(id.substr(0, 3)) > -1
}

init()

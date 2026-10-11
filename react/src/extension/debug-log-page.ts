// Content script on the classic single-log page (ApexDebugLogDetailEdit):
// colors and indents the log, with themes (core/log/themes.ts, applied through
// css/debug.css), font size, id links, filters and expandable USER_DEBUG
// values (HTML, JSON, Apex objects).
import { pageSalesforce } from '../core/page-session'
import { logToBlocks, type LogBlock } from '../core/log/classic-blocks'
import {
  beautifyUserDebug,
  canBeautify,
  splitIds,
  splitUserDebug
} from '../core/log/parsing'
import {
  logThemes,
  resolveThemeName,
  themeByName,
  themeCssVariables
} from '../core/log/themes'

// Log text is untrusted (System.debug of a public Site's input, record data):
// it only ever reaches the page as text nodes, never as HTML.

let keyPrefixes: string[] = []

function setSetting(key: string, value: any) {
  localStorage.setItem(key, value)
}

function getSetting(key: string): string | null {
  return localStorage.getItem(key)
}

function init() {
  document.body.addEventListener('keyup', keyUpListener)
  const codeBlock = document.querySelector('pre')
  const debugText = document.createElement('div')
  debugText.id = 'debugText'
  applyTheme(debugText, getSetting('style'))
  const showTimestamps = JSON.parse(getSetting('showTimeStamp'))
  for (const block of logToBlocks(codeBlock.textContent, showTimestamps)) {
    debugText.append(...renderBlock(block))
  }
  codeBlock.replaceChildren(debugText)
  document.querySelector<HTMLElement>('.oLeft').style.display = 'none'
  const oRight = document.querySelector('.oRight')
  oRight.insertBefore(codeBlock, oRight.firstChild)
  addControllersContainer()
  addDropDowns()
  removeIllegalIdLinks()
  const userDebugDivs = toArray(document.getElementsByClassName('debug'))
  userDebugDivs.forEach(debugDiv => {
    setTimeout(addExpansionButtonsForUserDebugDivs.bind(null, debugDiv), 0)
  })
  addCollapseAllButton()
  addCheckboxes()
}

function addControllersContainer() {
  const container = document.createElement('div')
  container.id = 'controllersContainer'
  addToTop(container)
}

function toArray(elementList: ArrayLike<any>): any[] {
  return [].slice.call(elementList)
}

function addDropDowns() {
  addController(generateStyleSelect())
  addController(generateFontSelect())
  const styleSelection =
    document.querySelector<HTMLSelectElement>('#styleSelection')
  styleSelection.value = resolveThemeName(getSetting('style'))
  const savedFontSize = getSetting('fontSize')
  const fontSize = savedFontSize || 18
  const fontSizeSelection: any = document.querySelector('#fontSelection')
  fontSizeSelection.value = fontSize
  fontSizeSelection.onchange()
}

function generateFontSelect() {
  const selectStyleContainer = document.createElement('span')
  selectStyleContainer.id = 'selectFontContainer'
  const label = document.createElement('label')
  label.textContent = 'Font Size:'
  const dropDown = document.createElement('select')
  dropDown.id = 'fontSelection'
  for (let size = 12; size < 29; size++) {
    const opt = document.createElement('option')
    opt.value = String(size)
    opt.textContent = String(size)
    dropDown.appendChild(opt)
  }
  dropDown.onchange = function () {
    document.querySelector<HTMLElement>('#debugText').style.fontSize =
      dropDown.value + 'px'
    setSetting('fontSize', dropDown.value)
  }
  selectStyleContainer.appendChild(label)
  selectStyleContainer.appendChild(dropDown)
  return selectStyleContainer
}

function generateStyleSelect() {
  const selectStyleContainer = document.createElement('span')
  selectStyleContainer.id = 'selectStyleContainer'
  const label = document.createElement('label')
  label.textContent = 'Pick Style: '
  const dropDown = document.createElement('select')
  dropDown.id = 'styleSelection'
  Object.values(logThemes).forEach(theme => {
    const opt = document.createElement('option')
    opt.value = theme.name
    opt.textContent = theme.label
    dropDown.appendChild(opt)
  })
  dropDown.onchange = function () {
    applyTheme(document.querySelector('#debugText'), dropDown.value)
    setSetting('style', dropDown.value)
  }
  selectStyleContainer.appendChild(label)
  selectStyleContainer.appendChild(dropDown)
  return selectStyleContainer
}

// Sets the theme's colors and fonts as CSS custom properties, which the rules
// in css/debug.css apply to each category's class. The class name is the
// theme's name. Saved names of earlier versions map to their current theme.
function applyTheme(debugText: HTMLElement, name: string | null) {
  const theme = themeByName(name)
  debugText.className = theme.name
  for (const [property, value] of Object.entries(themeCssVariables(theme))) {
    debugText.style.setProperty(property, value)
  }
}

function addCheckboxes() {
  const showSystemLabel = document.createElement('label')
  showSystemLabel.className = 'toggleHidden'
  showSystemLabel.innerHTML =
    '<input type="checkbox" name="checkbox" id="showSystem"/>Show <u>S</u>ystem Methods</label>'
  const showMethodLogLabel = document.createElement('label')
  showMethodLogLabel.className = 'toggleHidden'
  showMethodLogLabel.innerHTML =
    '<input type="checkbox" name="checkbox" checked="checked" id="showUserMethod" />Show <u>U</u>ser Methods</label>'
  const showTimeStamp = document.createElement('label')
  showTimeStamp.className = 'toggleHidden'
  showTimeStamp.innerHTML =
    '<input type="checkbox" name="checkbox" id="showTimestamps"/>Show <u>T</u>imestamps</label>'
  addToTop(showMethodLogLabel)
  addToTop(showSystemLabel)
  addToTop(showTimeStamp)
  const showTimestamps = document.getElementById(
    'showTimestamps'
  ) as HTMLInputElement
  showTimestamps.checked = JSON.parse(getSetting('showTimeStamp'))
  showTimestamps.onchange = toggleTimestamp
  document.getElementById('showUserMethod').onchange = toggleHidden('methodLog')
  document.getElementById('showSystem').onchange =
    toggleHidden('systemMethodLog')
}

function toggleTimestamp() {
  const oldValue = JSON.parse(getSetting('showTimeStamp'))
  setSetting('showTimeStamp', !oldValue)
  document.location.reload()
}

function addCollapseAllButton() {
  const button = document.createElement('button')
  button.innerHTML = '<u>E</u>xpand All'
  button.onclick = collapseAll
  button.id = 'collapseAllButton'
  button.className = 'myButton'
  addToTop(button)
}

function collapseAll() {
  toArray(document.querySelectorAll('.expandUserDebugBtn.collapsed')).forEach(
    button => {
      setTimeout(expandUserDebug.bind(button), 0)
    }
  )
  this.innerHTML = 'Collaps<u>e</u> All'
  this.onclick = function () {
    toArray(document.querySelectorAll('.expandUserDebugBtn.expanded')).forEach(
      button => {
        setTimeout(button.onclick.bind(button), 0)
      }
    )
    this.innerHTML = '<u>E</u>xpand All'
    this.onclick = collapseAll
  }
}

function addToTop(nodeElement: Node) {
  document
    .querySelector('.codeBlock')
    .insertBefore(nodeElement, document.getElementById('debugText'))
}

function addController(controller: Node) {
  document.querySelector('#controllersContainer').appendChild(controller)
}

function keyUpListener(event: KeyboardEvent) {
  if (event.keyCode == 85) {
    // 'u'
    clickOn(document.querySelector('#showUserMethod'))
  } else if (event.keyCode == 83) {
    // 's'
    clickOn(document.querySelector('#showSystem'))
  } else if (event.keyCode == 69) {
    // 'e'
    clickOn(document.querySelector('#collapseAllButton'))
  } else if (event.keyCode == 84) {
    // 't'
    clickOn(document.querySelector('#showTimestamps'))
  }
}

function clickOn(nodeElement: Element) {
  const event = document.createEvent('MouseEvents')
  event.initEvent('click', true, true)
  nodeElement.dispatchEvent(event)
}

// Text with each Salesforce id as a link. legalOnly: other ids stay text;
// otherwise every id is linked and ids of unknown objects are disabled once
// the org's key prefixes are known (see removeIllegalIdLinks).
function withIdLinks(text: string, legalOnly = false): Node[] {
  return splitIds(text).map(part => {
    if (typeof part === 'string') return document.createTextNode(part)
    const legal = isLegalId(part.id)
    if (legalOnly && !legal) return document.createTextNode(part.id)
    const link = document.createElement('a')
    link.href = '/' + part.id
    link.className = keyPrefixes.length && !legal ? 'disableClick' : 'idLink'
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

function addExpansionButtonsForUserDebugDivs(userDebugDiv: HTMLElement) {
  const userDebug = splitUserDebug(userDebugDiv.textContent)
  if (!userDebug) return
  userDebugDiv.replaceChildren(
    span('debugHeader searchable', userDebug.header),
    ' ',
    span('debugContent searchable', userDebug.message)
  )
  if (canBeautify(userDebug.message)) {
    const buttonExpand = document.createElement('button')
    buttonExpand.onclick = expandUserDebug
    buttonExpand.onmouseup = haltEvent
    buttonExpand.className = 'expandUserDebugBtn collapsed myButton'
    buttonExpand.textContent = '+'
    userDebugDiv.insertBefore(buttonExpand, userDebugDiv.children[0])
  }
}

function haltEvent(event: Event) {
  event.stopPropagation()
}

function removeIllegalIdLinks() {
  pageSalesforce()
    .keyPrefixes()
    .then(function (prefixes) {
      keyPrefixes = [...prefixes, '03d'] // 03d: validation rule
      const idLinks = document.getElementsByClassName('idLink')
      toArray(idLinks).forEach(link => {
        if (!isLegalId(link.textContent)) {
          link.className = 'disableClick'
        }
      })
    })
}

function isLegalId(id: string) {
  return keyPrefixes.indexOf(id.substr(0, 3)) > -1
}

function toggleHidden(className: string) {
  return function (event: any) {
    const systemLogs = toArray(document.getElementsByClassName(className))
    systemLogs.forEach(systemLog => {
      systemLog.style.display = event.srcElement.checked ? 'block' : 'none'
    })
  }
}

function expandUserDebug() {
  const debugNode = this.nextElementSibling.nextElementSibling
  const collapsedNodes = [...debugNode.childNodes]
  const expanded = beautifyUserDebug(debugNode.textContent)
  debugNode.replaceChildren(...withIdLinks(expanded, true))
  this.textContent = '-'
  this.classList.add('expanded')
  this.classList.remove('collapsed')
  this.onclick = function () {
    debugNode.replaceChildren(...collapsedNodes)
    this.classList.remove('expanded')
    this.classList.add('collapsed')
    this.textContent = '+'
    this.onclick = expandUserDebug
    this.onmouseup = haltEvent
  }
}

init()

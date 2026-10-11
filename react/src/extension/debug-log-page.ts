// Content script on the classic single-log page (ApexDebugLogDetailEdit):
// colors and indents the log, with themes (css/debug.css), font size, id links,
// filters and expandable USER_DEBUG values (HTML, JSON, Apex objects).
import jsBeautify from 'js-beautify'
import { API_PATH, sfRequest } from '../core/page-session'

let keyPrefixes: string[] = []
const idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g
const logEntryToDivTagClass = [
  { logEntry: '|USER_DEBUG', divClass: 'debug' },
  { logEntry: '|SYSTEM_', divClass: 'system systemMethodLog searchable' },
  { logEntry: '|SOQL_EXECUTE_', divClass: 'soql searchable wrap' },
  { logEntry: '|SOQL_EXECUTE_END', divClass: 'soql searchable wrap' },
  { logEntry: '|METHOD_', divClass: 'method methodLog searchable' },
  { logEntry: '|CONSTRUCTOR_', divClass: 'method methodLog searchable' },
  { logEntry: '|EXCEPTION_', divClass: 'err searchable' },
  { logEntry: '|FATAL_ERROR', divClass: 'err searchable' },
  { logEntry: '|CODE_UNIT', divClass: 'method searchable' },
  { logEntry: '|CALLOUT', divClass: 'callout searchable' },
  { logEntry: '|VALIDATION_', divClass: 'method searchable' },
  { logEntry: '|EXECUTION_', divClass: 'rest searchable' },
  { logEntry: '|DML_BEGIN', divClass: 'rest searchable' },
  { logEntry: '|DML_END', divClass: 'rest searchable' },
  {
    logEntry: '|ENTERING_MANAGED_PKG',
    divClass: 'system systemMethodLog searchable'
  }
]

function setSetting(key: string, value: any) {
  localStorage.setItem(key, value)
}

function getSetting(key: string): string | null {
  return localStorage.getItem(key)
}

function init() {
  document.body.addEventListener('keyup', keyUpListener)
  const codeElement = document.querySelector('pre')
  const debugText = escapeHtml(codeElement.textContent)
  const res = debugText
    .split('\n')
    .map(addTagsToKnownLines)
    .reduce(toMultilineDivs)
  const codeBlock = document.querySelector('pre')
  codeBlock.innerHTML = '<div class="monokai" id="debugText">' + res + '</div>'
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
  const savedStyle = getSetting('style')
  if (savedStyle) {
    const styleSelection: any = document.querySelector('#styleSelection')
    styleSelection.value = savedStyle
    styleSelection.onchange()
  }
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
  const styles = [
    { name: 'monokai', label: 'Monokai' },
    { name: 'bw', label: 'Black/White' },
    { name: 'emacs', label: 'Emacs' }
  ]
  styles.forEach(style => {
    const opt = document.createElement('option')
    opt.value = style.name
    opt.textContent = style.label
    dropDown.appendChild(opt)
  })
  dropDown.onchange = function () {
    document.querySelector('#debugText').className = dropDown.value
    setSetting('style', dropDown.value)
  }
  selectStyleContainer.appendChild(label)
  selectStyleContainer.appendChild(dropDown)
  return selectStyleContainer
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

function addExpansionButtonsForUserDebugDivs(userDebugDiv: HTMLElement) {
  const debugLevelMatch = userDebugDiv.innerHTML.match(/\[\d+\](\|[A-Z]+\|)/)
  if (!debugLevelMatch) return
  const debugLevel = debugLevelMatch[1]
  const debugParts = userDebugDiv.innerHTML.split(debugLevel)
  userDebugDiv.innerHTML =
    '<span class="debugHeader searchable">' +
    debugParts[0] +
    debugLevel +
    '</span> <span class="debugContent searchable">' +
    debugParts[1] +
    '</span>'
  const debugText = unescapeHtml(debugParts[1])
  if (
    looksLikeHtml(debugText) ||
    looksLikeSfdcObject(debugText) ||
    isJsonString(debugText)
  ) {
    const buttonExpand = document.createElement('button')
    buttonExpand.onclick = expandUserDebug
    buttonExpand.onmouseup = haltEvent
    buttonExpand.className = 'expandUserDebugBtn collapsed myButton'
    buttonExpand.textContent = '+'
    userDebugDiv.insertBefore(buttonExpand, userDebugDiv.children[0])
  }
}

function toMultilineDivs(prevVal: string, curLine: string, index: number) {
  if (index == 1) {
    // handling first line
    return '<div class="rest">' + prevVal + '</div>' + curLine
  } else if (
    curLine.lastIndexOf('</div>') == curLine.length - '</div>'.length &&
    curLine.length - '</div>'.length != -1
  ) {
    // current line ends with <div> tag all good
    return prevVal + curLine
  } else {
    // expanding <div> to mutliline (e.g. LIMIT_USAGE_FOR_NS is multiline and cant recognise each line separately or USER_DEBUG with /n)
    return (
      prevVal.substr(0, prevVal.length - '</div>'.length) +
      '\n' +
      curLine +
      '</div>'
    )
  }
}

function addTagsToKnownLines(curLine: string) {
  if (curLine.indexOf('Execute Anonymous:') === 0) {
    return '<div class="system searchable">' + curLine + '</div>'
  }
  if (curLine.search(idRegex) > -1) {
    curLine = curLine.replace(idRegex, '<a href="/$&" class="idLink">$&</a>')
  }
  const timeStampIndex = curLine.indexOf('|')
  let cutLine: string
  if (timeStampIndex > -1) {
    cutLine = curLine.substr(timeStampIndex + 1)
  }
  let resultTag = ''
  for (let i = 0; i < logEntryToDivTagClass.length; i++) {
    if (curLine.indexOf(logEntryToDivTagClass[i].logEntry) > -1) {
      resultTag =
        '<div class="' +
        logEntryToDivTagClass[i].divClass +
        '">' +
        (JSON.parse(getSetting('showTimeStamp')) ? curLine : cutLine) +
        '</div>'
      break
    }
  }
  if (resultTag) {
    return resultTag
  }
  const splitedDebugLine = curLine.split('|')
  if (!splitedDebugLine || splitedDebugLine.length <= 2) {
    return curLine
  }
  return '<div class="rest searchable">' + curLine + '</div>'
}

function haltEvent(event: Event) {
  event.stopPropagation()
}

function removeIllegalIdLinks() {
  sfRequest(API_PATH + '/sobjects')
    .then(r => r.json())
    .then(function (response) {
      const sobjects: any[] = response.sobjects
      keyPrefixes = sobjects
        .filter(sobj => sobj.keyPrefix !== undefined)
        .map(sobjectDescribe => sobjectDescribe.keyPrefix)
      keyPrefixes.push('03d') // validation rule
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
  const oldHtmlVal = debugNode.innerHTML
  const debugNodeText = debugNode.textContent
  if (looksLikeHtml(debugNodeText)) {
    debugNode.textContent = jsBeautify.html(debugNodeText)
  } else if (looksLikeSfdcObject(debugNodeText)) {
    debugNode.textContent = jsBeautify.js(sfdcObjectBeautify(debugNodeText))
  } else if (isJsonString(debugNodeText)) {
    debugNode.textContent = jsBeautify.js(debugNodeText)
  }
  if (debugNodeText.search(idRegex) > -1) {
    debugNode.innerHTML = debugNode.textContent.replace(
      idRegex,
      withLegalIdLink
    )
  }
  this.textContent = '-'
  this.classList.add('expanded')
  this.classList.remove('collapsed')
  this.onclick = function () {
    debugNode.innerHTML = oldHtmlVal
    this.classList.remove('expanded')
    this.classList.add('collapsed')
    this.textContent = '+'
    this.onclick = expandUserDebug
    this.onmouseup = haltEvent
  }
}

function withLegalIdLink(id: string) {
  if (isLegalId(id)) {
    return '<a href="/' + id + '" class="idLink">' + id + '</a>'
  } else {
    return id
  }
}

function sfdcObjectBeautify(string: string) {
  string = string.replace(/={/g, ':{')
  return string.replace(
    /([{| |\[]\w+)=(.+?)(?=, |},|}\)|:{|])/g,
    function (match, p1, p2) {
      return p1 + ":'" + p2 + "'"
    }
  )
}

function looksLikeSfdcObject(string: string) {
  return string.match(/\w+:{\w+=.+,?\s*}/)
}

function looksLikeHtml(source: string) {
  const trimmed = source.replace(/^[ \t\n\r]+/, '')
  return trimmed && trimmed.substring(0, 1) === '<'
}

function isJsonString(str: string) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

function escapeHtml(text: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

function unescapeHtml(str: string) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

init()

import globalSf from '../../global-sf'

const idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g,
  debugDescRegex = /(\d\d:\d\d:\d\d\.\d{3}\s+\(\d{8}\))\|(\w+)\|/,
  logEntryToDivTagClass = [{
    logEntry: '|USER_DEBUG',
    divClass: 'debug'
  }, {
    logEntry: '|SYSTEM_',
    divClass: 'system systemMethodLog'
  }, {
    logEntry: '|SOQL_EXECUTE_',
    divClass: 'soql wrap'
  }, {
    logEntry: '|SOQL_EXECUTE_END',
    divClass: 'soql wrap'
  }, {
    logEntry: '|METHOD_',
    divClass: 'method methodLog'
  }, {
    logEntry: '|CONSTRUCTOR_',
    divClass: 'method methodLog'
  }, {
    logEntry: '|EXCEPTION_',
    divClass: 'err'
  }, {
    logEntry: '|FATAL_ERROR',
    divClass: 'err'
  }, {
    logEntry: '|CODE_UNIT',
    divClass: 'method'
  }, {
    logEntry: '|CALLOUT',
    divClass: 'callout'
  }, {
    logEntry: '|VALIDATION_',
    divClass: 'method'
  }, {
    logEntry: '|EXECUTION_',
    divClass: 'rest'
  }, {
    logEntry: '|DML_BEGIN',
    divClass: 'rest'
  }, {
    logEntry: '|DML_END',
    divClass: 'rest'
  }, {
    logEntry: '|ENTERING_MANAGED_PKG',
    divClass: 'system systemMethodLog '
  }]

export function parseLog (logBody) {
  const res = escapeHtml(logBody).split('\n').map(addTagsToKnownLines).reduce(toMultilineDivs)
  return {__html: `<div class="monokai" id="debugText"> ${res} </div>`}
}

function escapeHtml (text) {
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }

  return text.replace(/[&<>"']/g, function (m) {
    return map[m]
  })
}

function addTagsToKnownLines (curLine) {
  if (curLine.indexOf('Execute Anonymous:') === 0) {
    return '<div class="system searchable">' + curLine + '</div>'
  }
  if (curLine.search(idRegex) > -1) {
    curLine = curLine.replace(idRegex, '<a href="/$&" class="idLink">$&</a>')
  }
  var timeStampIndex = curLine.indexOf('|')
  var cutLine
  if (timeStampIndex > -1) {
    cutLine = curLine.substr(timeStampIndex + 1)
  }
  var resultTag = ''
  var i
  for (i = 0; i < logEntryToDivTagClass.length; i++) {
    if (curLine.indexOf(logEntryToDivTagClass[i].logEntry) > -1) {
      resultTag = '<div class="' + logEntryToDivTagClass[i].divClass + '">' +
        (JSON.parse('true') ? curLine : cutLine) + '</div>' // getSetting('showTimeStamp')
      break
    }
  }
  if (resultTag) {
    return resultTag
  }
  var splitedDebugLine = curLine.split('|')
  if (!splitedDebugLine || splitedDebugLine.length <= 2) {
    return curLine
  }
  return '<div class="rest searchable">' + curLine + '</div>'
}

function toMultilineDivs (prevVal, curLine, index) {
  if (index == 1) { // handling first line
    return '<div class="rest">' + prevVal + '</div>' + curLine
  } else if (curLine.lastIndexOf('</div>') == curLine.length - '</div>'.length && curLine.length - '</div>'.length != -1) { // current line ends with <div> tag all good
    return prevVal + curLine
  } else { // expanding <div> to mutliline (e.g. LIMIT_USAGE_FOR_NS is multiline and cant recognise each line separately or USER_DEBUG with /n)
    return prevVal.substr(0, prevVal.length - '</div>'.length) + '\n' + curLine + '</div>'
  }
}

export function addExpansionButtons () {
  [...document.getElementsByClassName('debug')].forEach((debugDiv) => {
    setTimeout(() => addExpnasionButtonToDiv(debugDiv), 0)
  })
}

function addExpnasionButtonToDiv (userDebugDiv) {
  var debugLevel = userDebugDiv.innerHTML.match(/\[\d+\](\|[A-Z]+\|)/)
  if (!debugLevel) return
  debugLevel = debugLevel[1]
  var debugParts = userDebugDiv.innerHTML.split(debugLevel)
  userDebugDiv.innerHTML = '<span class="debugHeader searchable">' +
    debugParts[0] + debugLevel + '</span> <span class="debugContent searchable">' +
    debugParts[1] + '</span>'
  var debugText = unescapeHtml(debugParts[1])
  var debugTextParentObj = document.getElementById('debugText')
  if (looksLikeHtml(debugText) || looksLikeSfdcObject(debugText) || isJsonString(debugText)) {
    var buttonExpand = document.createElement('button')
    buttonExpand.onclick = expandUserDebug
    buttonExpand.onmouseup = e => e.stopPropagation()
    buttonExpand.className = 'expandUserDebugBtn collapsed myButton'
    buttonExpand.textContent = '+'
    userDebugDiv.insertBefore(buttonExpand, userDebugDiv.children[0])
  }
}

function isJsonString (str) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

function sfdcObjectBeautify (string) {
  string = string.replace(/={/g, ':{')
  return string.replace(/([{| |\[]\w+)=(.+?)(?=, |},|}\)|:{|])/g, function (match, p1, p2) {
    return p1 + ":'" + p2 + "'"
  })
}

function looksLikeSfdcObject (string) {
  return string.match(/\w+:{\w+=.+,?\s*}/)
}

function looksLikeHtml (source) {
  var trimmed = source.replace(/^[ \t\n\r]+/, '')
  return (trimmed && trimmed.substring(0, 1) === '<')
}

function unescapeHtml (str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'')
}

function expandUserDebug () {
  var debugNode = this.nextElementSibling.nextElementSibling
  var oldHtmlVal = debugNode.innerHTML
  var debugNodeText = debugNode.textContent
  if (looksLikeHtml(debugNodeText)) {
    debugNode.textContent = html_beautify(debugNodeText)
  } else if (looksLikeSfdcObject(debugNodeText)) {
    debugNode.textContent = js_beautify(sfdcObjectBeautify(debugNodeText))
  } else if (isJsonString(debugNodeText)) {
    debugNode.textContent = js_beautify(debugNodeText)
  }
  if (debugNodeText.search(idRegex) > -1) {
    debugNode.innerHTML = debugNode.textContent.replace(idRegex, withLegalIdLink)
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

function withLegalIdLink (id) {
  if (isLegalId(id)) {
    return '<a href="/' + id + '" class="idLink">' + id + '</a>'
  } else {
    return id
  }
}

function isLegalId (id) {
  return true// (keyPrefixes.indexOf(id.substr(0, 3)) > -1);
}

// Content script on the classic debug log list (listApexTraces.apexp): Delete
// All (Bulk API), Load New Logs, Add Current User, logs per page, search in
// log bodies, and hotkeys for each. Opens the log viewer for ?openApp=yes
// (see shortcuts.ts).
import Mousetrap from 'mousetrap'
import {
  API_PATH,
  ASYNC_API_PATH,
  getSession,
  getToken,
  getUserId,
  openAppMessage,
  parseDiscoCookie,
  sfRequest
} from '../core/page-session'

const LOGS_TABLE_ID = 'Apex_Trace_List:traceForm:traceTable:thetracetable:tb'
const LOGS_TABLE_ID_ESCAPED = LOGS_TABLE_ID.replace(/:/g, '\\:')
const USERS_TABLE_ID = 'Apex_Trace_List:monitoredUsersForm'
let showLogsNum: any = 50
const tableElement = document.getElementById(LOGS_TABLE_ID)

async function openAppIfRequested() {
  if (!document.location.search.includes('openApp=yes')) {
    return
  }
  const { orgId, userId } = parseDiscoCookie()
  const session = await getSession()
  chrome.runtime.sendMessage(openAppMessage(orgId, userId, session))
  window.close()
}

function initKeyTraps() {
  Mousetrap.bind('l', clickOn('#load_new_logs'))
  Mousetrap.bind('u', clickOn('#add_current_user'))
  Mousetrap.bind('c', clickOn('#clear_search'))
  Mousetrap.bind('r', focusOn('#FilterByText'))
  Mousetrap.bind('a', function () {
    const dontConfirm = JSON.parse(
      localStorage.getItem('dontConfirmDeleteAllHotKey')
    )
    if (dontConfirm) {
      clickOn('#real_delete_all')()
    } else {
      if (confirm('This will delete all logs')) {
        localStorage.setItem('dontConfirmDeleteAllHotKey', 'true')
        clickOn('#real_delete_all')()
      }
    }
  })
}

function clickOn(selector: string) {
  return function () {
    document.querySelector<HTMLElement>(selector).click()
  }
}

function focusOn(selector: string) {
  return function (event: Event) {
    event.preventDefault()
    document.querySelector<HTMLElement>(selector).focus()
  }
}

function initPage() {
  openAppIfRequested()
  addDeleteAllBtn()
  removeOldDeleteBtn()
  addAddUserBtn()
  addReloadControllers()
  addSearchControllers()
  initKeyTraps()
}

function removeOldDeleteBtn() {
  const oldButtons = document.querySelectorAll('[value="Delete All"]')
  toArray(oldButtons).forEach(button => {
    button.parentNode.removeChild(button)
  })
}

function addAddUserBtn() {
  const pbButton = document
    .getElementById(USERS_TABLE_ID)
    .querySelector('.pbButton')
  const addUserButton = document.createElement('input')
  addUserButton.type = 'button'
  addUserButton.className = 'btn'
  addUserButton.value = 'Add Current (U)ser'
  addUserButton.id = 'add_current_user'
  addUserButton.onclick = addCurrentUser
  pbButton.appendChild(addUserButton)
}

function addReloadControllers() {
  document.getElementById(
    'Apex_Trace_List:traceForm:traceTableNextPrev'
  ).style.display = 'none'
  document
    .getElementById('Apex_Trace_List:traceForm:traceTable')
    .querySelector<HTMLElement>('.mainTitle').style.display = 'none'
  const numOfLogsLabel = document.createElement('label')
  numOfLogsLabel.style.float = 'right'
  numOfLogsLabel.innerHTML =
    `Maximum logs per Page:&nbsp;` +
    `<input type="number" min="25" max="1000" step="25" value="${showLogsNum}" >`
  const numOfLogsInput = numOfLogsLabel.firstElementChild as HTMLInputElement
  numOfLogsInput.onchange = function () {
    showLogsNum = numOfLogsInput.value
    loadLogs()
  }
  document
    .getElementById('Apex_Trace_List:traceForm')
    .querySelector('.pbButton')
    .appendChild(numOfLogsLabel)
}

function addDeleteAllBtn() {
  const deleteAllContainer = document
    .getElementById('Apex_Trace_List:traceForm')
    .querySelector('.pbButton')
  const realDeleteAllBtn = document.createElement('input')
  realDeleteAllBtn.type = 'button'
  realDeleteAllBtn.className = 'btn'
  realDeleteAllBtn.value = 'Delete (A)ll '
  realDeleteAllBtn.id = 'real_delete_all'
  realDeleteAllBtn.onclick = realDeleteAll
  deleteAllContainer.appendChild(realDeleteAllBtn)
  const loadNewLogsBtn = document.createElement('input')
  loadNewLogsBtn.type = 'button'
  loadNewLogsBtn.className = 'btn'
  loadNewLogsBtn.value = '(L)oad New Logs'
  loadNewLogsBtn.id = 'load_new_logs'
  loadNewLogsBtn.onclick = loadNewLogs
  deleteAllContainer.appendChild(loadNewLogsBtn)
}

function realDeleteAll(event: Event) {
  event.preventDefault()
  document.body.style.cursor = 'wait'

  sfRequest(
    API_PATH +
      '/tooling/query/?q=' +
      encodeURIComponent('Select Id From ApexLog')
  )
    .then(r => r.json())
    .then(function (responseObject) {
      if (responseObject.records.length == 0) {
        document.body.style.cursor = 'auto'
        return
      }
      const logIdsCsv = responseObject.records
        .map((logObj: any) => `"${logObj.Id}"`)
        .reduce((sum: string, id: string) => sum + '\n' + id, '"Id"')
      return createJob('ApexLog', 'delete').then(function (jobId) {
        createBatch(jobId, logIdsCsv).then(function (batchId) {
          pollBatchStatus(jobId, batchId).then(function () {
            location.reload()
          })
        })
      })
    })
}

function loadedLogIds() {
  const trs = toArray(document.getElementById(LOGS_TABLE_ID).children)
  return trs.map(tr => {
    const td = tr.firstElementChild
    const a = td.firstElementChild
    const params = a.href.split('=')
    return params.pop()
  })
}

function loadNewLogs() {
  const oldLogIds = loadedLogIds()
  requestLogs().then(function (logs) {
    const deltaLogs = logs.filter(log => oldLogIds.indexOf(log.Id) === -1)
    const deltaLogTrs = deltaLogs.map(logRecordToTr)
    deltaLogTrs.forEach(addToTable)
    animateTrsAddition(deltaLogTrs)
    removeOldLogs()
  })
}

function removeOldLogs() {
  const oldTrs = toArray(
    document.querySelectorAll(
      `#${LOGS_TABLE_ID_ESCAPED} tr:nth-child(n+${
        parseInt(showLogsNum, 10) + 1
      })`
    )
  )
  animateTrsRemoval(oldTrs)
  setTimeout(function () {
    oldTrs.forEach(tr => {
      try {
        tableElement.removeChild(tr)
      } catch (e) {
        console.error(e)
      }
    })
  }, 1000)
}

function loadLogs(event?: Event) {
  if (event) {
    event.preventDefault()
  }
  clearTable()
  return requestLogs().then(function (logs) {
    logs.map(logRecordToTr).forEach(addToTable)
  })
}

function addToTable(tr: HTMLElement) {
  if (tableElement.firstChild) {
    tableElement.insertBefore(tr, tableElement.firstChild)
  } else {
    tableElement.appendChild(tr)
  }
}

// All logs in the org, like Salesforce's own list. Filtering by the users in
// the "Monitored Users" table hid logs of entities without a user link there,
// such as the Automated Process user (#10).
function requestLogs(): Promise<any[]> {
  const selectQuery = [
    `SELECT LogUser.Name,Application,DurationMilliseconds,`,
    `Id,LastModifiedDate,Location,LogLength,LogUserId,`,
    `Operation,Request,StartTime,Status,SystemModstamp From `,
    `ApexLog ORDER BY `,
    `LastModifiedDate DESC LIMIT ${showLogsNum}`
  ].join('')
  return (
    sfRequest(API_PATH + '/tooling/query/?q=' + encodeURIComponent(selectQuery))
      .then(r => r.json())
      // Newest first from the query; the table is filled by inserting each row
      // at the top, so add them oldest first.
      .then(responseObj => responseObj.records.reverse())
      .catch(function (err) {
        console.error(err)
      })
  )
}

function animateTrsRemoval(trs: HTMLElement[]) {
  trs.forEach(tr => {
    toArray(tr.children).forEach(td => {
      td.className = ''
      td.style.padding = '0px'
    })
    tr.style.fontSize = '0px'
    tr.style.padding = '0px !important'
    tr.style.height = '0px'
  })
}

function animateTrsAddition(trs: HTMLElement[]) {
  prepareTransition(trs)
  setTimeout(function makeTransition() {
    trs.forEach(tr => {
      tr.style.height = '23px'
    })
  }, 0)
  setTimeout(function finishTransition() {
    trs.forEach(tr => {
      tr.style.fontSize = '12px'
      toArray(tr.children).forEach((td, i) => {
        td.className = i === 0 ? 'dataCell  actionColumn' : 'dataCell'
        td.style.padding = ''
      })
    })
  }, 1000)
}

function prepareTransition(logTrs: HTMLElement[]) {
  logTrs.forEach(tr => {
    tr.style.fontSize = '0px'
    tr.style.padding = '0px !important'
    tr.style.height = '0px'
    toArray(tr.children).forEach(td => {
      td.className = ''
      td.style.padding = '0px'
    })
  })
}

function logRecordToTr(logObj: any) {
  const tr = document.createElement('tr')
  tr.style.webkitTransition = 'all 500ms'
  tr.style.transition = 'all 500ms'
  tr.style.height = '23px'
  tr.dataset.id = logObj.Id
  const startTime = new Date(Date.parse(logObj.StartTime)).toLocaleString()
  // Built with textContent, not innerHTML: Operation, Request and the user
  // name come from the org's data, and requests to public Sites control some
  // of them, so they must never be parsed as HTML.
  const actions = cell('dataCell  actionColumn')
  actions.append(
    link(
      '/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=' +
        encodeURIComponent(logObj.Id),
      'View'
    ),
    ' | ',
    link(
      '/servlet/servlet.FileDownload?file=' + encodeURIComponent(logObj.Id),
      'Download'
    ),
    ' | ',
    link('#', 'Delete', 'actionLink deleteActionLink')
  )
  const user = cell('dataCell')
  user.append(
    link(
      '/' + encodeURIComponent(logObj.LogUserId),
      logObj.LogUser ? logObj.LogUser.Name : ''
    )
  )
  tr.append(actions, user)
  ;[
    logObj.Request,
    logObj.Application,
    logObj.Operation,
    logObj.Status,
    logObj.DurationMilliseconds,
    logObj.LogLength,
    startTime
  ].forEach(value => {
    const td = cell('dataCell')
    td.textContent = value == null ? '' : String(value)
    tr.append(td)
  })
  return tr
}

function cell(className: string) {
  const td = document.createElement('td')
  td.className = className
  td.colSpan = 1
  return td
}

function link(href: string, text: string, className?: string) {
  const a = document.createElement('a')
  a.href = href
  a.className = className || 'actionLink'
  a.textContent = text
  return a
}

function clearTable() {
  document.getElementById(LOGS_TABLE_ID).innerHTML = ''
}

async function addCurrentUser(event?: Event) {
  if (event) event.preventDefault()
  const token = await getToken()
  const logLevelName = 'ApexDebugger'
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    Authorization: 'Bearer ' + token,
    Accept: '*/*'
  }
  const query = encodeURI(
    "Select Id From DebugLevel Where DeveloperName = '" + logLevelName + "'"
  )
  const debugLevelPayload = {
    DeveloperName: logLevelName,
    MasterLabel: logLevelName,
    Workflow: 'DEBUG',
    Validation: 'DEBUG',
    Callout: 'DEBUG',
    ApexCode: 'DEBUG',
    ApexProfiling: 'DEBUG',
    Visualforce: 'DEBUG',
    System: 'DEBUG',
    Database: 'DEBUG'
  }
  return fetch(`${API_PATH}/tooling/query?q=${query}`, { headers })
    .then(res => res.json())
    .then(existingDebugLevel => {
      if (existingDebugLevel.records.length > 0) {
        return existingDebugLevel.records[0].Id
      } else {
        return fetch(API_PATH + '/tooling/sobjects/DebugLevel', {
          method: 'POST',
          headers,
          body: JSON.stringify(debugLevelPayload)
        }).then(res => res.json().then(result => result.id))
      }
    })
    .then(dlId => {
      const payload = {
        TracedEntityId: getUserId(),
        DebugLevelId: dlId,
        LogType: 'USER_DEBUG'
      }
      fetch(API_PATH + '/tooling/sobjects/TraceFlag/', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }).then(res => res.json())
    })
}

function addSearchControllers() {
  const iframe = document.createElement('iframe')
  iframe.id = 'remember'
  iframe.name = 'remember'
  iframe.style.display = 'none'
  iframe.src = 'about:blank'
  document.body.appendChild(iframe)
  const form = document.createElement('form')
  form.method = 'post'
  form.target = 'remember'
  form.action = '/'
  form.onsubmit = searchLogs
  const input = document.createElement('input')
  input.type = 'text'
  input.id = 'FilterByText'
  input.autocomplete = 'on'
  input.placeholder = 'Sea(r)ch logs..'
  input.onkeydown = handleSearchKey
  const filter = document.createElement('button')
  filter.textContent = 'Search'
  filter.type = 'submit'
  const clearFilterBtn = document.createElement('button')
  clearFilterBtn.textContent = '(C)lear'
  clearFilterBtn.id = 'clear_search'
  clearFilterBtn.onclick = clearFilter
  const loadingImage = document.createElement('img')
  loadingImage.src = '/img/loading.gif'
  loadingImage.style.display = 'none'
  loadingImage.id = 'LoadinImage'
  form.appendChild(input)
  form.appendChild(filter)
  form.appendChild(clearFilterBtn)
  form.appendChild(loadingImage)
  const logsTitle = document.querySelector('.apexp .pbTitle')
  logsTitle.appendChild(form)
}

function handleSearchKey(e: KeyboardEvent) {
  if (e.keyCode === 27) {
    clearFilter(e)
  }
}

function clearFilter(e?: Event) {
  if (e) e.preventDefault()
  ;(document.getElementById('FilterByText') as HTMLInputElement).value = ''
  resetResults()
}

function resetResults() {
  toArray(document.getElementById(LOGS_TABLE_ID).children).forEach(element => {
    element.style.background = 'white'
  })
}

function toArray(nodeElements: ArrayLike<any>): any[] {
  return [].slice.call(nodeElements)
}

function searchLogs() {
  resetResults()
  document.body.style.cursor = 'wait'
  document.getElementById('LoadinImage').style.display = 'inline'
  const searchText = (
    document.getElementById('FilterByText') as HTMLInputElement
  ).value
  const searchRegex = new RegExp(escapeRegExp(searchText), 'gi')
  const logTableRows = toArray(document.getElementById(LOGS_TABLE_ID).children)
  const visibleLogRows = logTableRows
    .map(row => {
      if (!row.querySelector('td>a')) {
        return null
      }
      const link = row.querySelector('td>a').href
      const logIdParam = link
        .split('?')[1]
        .split('&')
        .filter((keyVal: string) => keyVal.indexOf('apex_log_id=') === 0)[0]
      return {
        element: row,
        id: logIdParam.split('=')[1]
      }
    })
    .filter(e => e)
  const promises = visibleLogRows.map(logRow => {
    return sfRequest(
      API_PATH + '/tooling/sobjects/ApexLog/' + logRow.id + '/Body'
    )
      .then(r => r.text())
      .then(rawLogContents => {
        if (searchRegex.test(rawLogContents)) {
          logRow.element.style.background = 'rgb(104, 170, 87)'
          return true
        }
        return false
      })
      .catch(function (err) {
        console.error(err)
        document.body.style.cursor = 'default'
        document.getElementById('LoadinImage').style.display = 'none'
      })
  })
  Promise.all(promises).then(function () {
    document.body.style.cursor = 'default'
    document.getElementById('LoadinImage').style.display = 'none'
  })
}

function createJob(objectName: string, operation: string): Promise<string> {
  const queryJob = `<?xml version="1.0" encoding="UTF-8"?>
   <jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
        <operation>${operation}</operation>
        <object>${objectName}</object>
        <concurrencyMode>Parallel</concurrencyMode>
        <contentType>CSV</contentType>
   </jobInfo>`
  return sfRequest(
    ASYNC_API_PATH + '/job',
    'POST',
    {
      'Content-Type': 'application/xml',
      'X-SFDC-Session': true
    },
    queryJob
  )
    .then(r => r.text())
    .then(response => response.match(/<id>(.*)<\/id>/)[1])
}

function pollBatchStatus(jobId: string, batchId: string) {
  return new Promise(function (resolve, reject) {
    const intervalId = setInterval(function () {
      checkBatchStatus(jobId, batchId).then(function (state) {
        if (state === 'Completed') {
          resolve(state)
          clearInterval(intervalId)
        }
        if (state === 'Error' || state === 'Not Processed') {
          reject(state)
          clearInterval(intervalId)
        }
      })
    }, 1000)
  })
}

function checkBatchStatus(jobId: string, batchId: string) {
  return sfRequest(`${ASYNC_API_PATH}/job/${jobId}/batch/${batchId}`, 'GET', {
    'X-SFDC-Session': true
  })
    .then(r => r.text())
    .then(resultXml => resultXml.match(/<state>(.*)<\/state>/)[1])
}

function createBatch(jobId: string, csv: string): Promise<string> {
  return sfRequest(
    `${ASYNC_API_PATH}/job/${jobId}/batch`,
    'POST',
    {
      'Content-Type': 'text/csv; charset=UTF-8',
      'X-SFDC-Session': true
    },
    csv
  )
    .then(r => r.text())
    .then(response => response.match(/<id>(.*)<\/id>/)[1])
}

function escapeRegExp(str: string) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
}

initPage()

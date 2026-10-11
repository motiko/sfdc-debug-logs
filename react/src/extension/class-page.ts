// Content script on the classic Apex class and trigger lists (/01p…,
// allTriggers.apexp): "See All" buttons and a "Dont Log Class" checkbox per
// class, which sets or removes a TraceFlag with every log category at NONE.
import { API_PATH, sfRequest } from '../core/page-session'

function toArray(nodeList: ArrayLike<any>): any[] {
  return [].slice.call(nodeList)
}

function addButton() {
  const classesRowsPerPageParameter =
      'all_classes_page:theTemplate:classList:rowsperpage',
    triggersRowsPerPageParameter =
      'all_triggers_page:theTemplate:j_id41:rowsperpage'

  if (document.getElementById('all_classes_page:theTemplate:theForm')) {
    const seeAllClasses = document.createElement('input')
    seeAllClasses.value = 'See All Classes'
    seeAllClasses.className = 'btn'
    seeAllClasses.type = 'button'
    seeAllClasses.onclick = function () {
      if (location.search.indexOf('rowsperpage=') > -1) {
        window.location.search =
          'setupid=ApexClasses&' +
          encodeURIComponent(classesRowsPerPageParameter) +
          '=3500'
      } else {
        window.location.search +=
          '&' + encodeURIComponent(classesRowsPerPageParameter) + '=3500'
      }
    }
    document
      .getElementById('all_classes_page:theTemplate:theForm')
      .querySelector('td')
      .appendChild(seeAllClasses)
  }
  if (document.querySelector('input[value="Developer Console"]')) {
    const seeAllTriggers = document.createElement('input')
    seeAllTriggers.value = 'See All Trigger'
    seeAllTriggers.className = 'btn'
    seeAllTriggers.type = 'button'
    seeAllTriggers.onclick = function () {
      if (location.search.indexOf('rowsperpage=') > -1) {
        window.location.search =
          'setupid=ApexClasses&' +
          encodeURIComponent(triggersRowsPerPageParameter) +
          '=3500'
      } else {
        window.location.search +=
          '&' + encodeURIComponent(triggersRowsPerPageParameter) + '=3500'
      }
    }
    document
      .querySelector('input[value="Developer Console"]')
      .parentNode.appendChild(seeAllTriggers)
  }
}

function addHeader() {
  const header = document.createElement('th')
  header.textContent = 'Dont Log Class'
  const selectAll = document.createElement('input')
  selectAll.type = 'checkbox'
  selectAll.onclick = function () {
    const checkedStatus = selectAll.checked
    toArray(document.querySelectorAll('.dontLog')).forEach(cbDontLog => {
      if (cbDontLog.checked != checkedStatus) {
        cbDontLog.checked = checkedStatus
        cbDontLog.onclick()
      }
    })
  }
  header.appendChild(selectAll)
  header.appendChild(createLoadingImage())
  document.querySelector('.headerRow').appendChild(header)
}

function createLoadingImage() {
  const loadingImage = document.createElement('img')
  loadingImage.src = '/img/loading.gif'
  loadingImage.style.display = 'none'
  loadingImage.className = 'LoadinImage'
  return loadingImage
}

function addCheckboxes() {
  const cell = document.createElement('td')
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'dontLog'
  cell.appendChild(checkbox)
  cell.appendChild(createLoadingImage())
  const dataRows = toArray(document.querySelectorAll('.dataRow'))
  dataRows.forEach(row => {
    setTimeout(function () {
      addCheckbox(row, cell)
    }, 0)
  })
}

function addCheckbox(row: any, cell: HTMLElement) {
  const clone: any = cell.cloneNode(true)
  const classLink = row.querySelector('th>a').href
  const classId = classLink.slice(classLink.lastIndexOf('/01') + 1)
  const isChecked = row.querySelector('td>img').title === 'Checked'
  clone.firstChild.dataset.classId = classId
  clone.firstChild.onclick = toggleTraceFlag
  clone.firstChild.checked = isChecked
  row.appendChild(clone)
}

function toggleTraceFlag() {
  const noLog: Record<string, string> = {
    Workflow: 'NONE',
    Validation: 'NONE',
    Callout: 'NONE',
    ApexCode: 'NONE',
    ApexProfiling: 'NONE',
    Visualforce: 'NONE',
    System: 'NONE',
    Database: 'NONE'
  }
  const checkbox = this
  const classId = checkbox.dataset.classId
  const dontLog = checkbox.checked
  checkbox.parentNode.children[1].style.display = 'inline'
  noLog.TracedEntityId = classId
  if (dontLog) {
    sfRequest(
      API_PATH + '/tooling/sobjects/TraceFlag/',
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify(noLog)
    ).then(
      function () {
        checkbox.parentNode.children[1].style.display = 'none'
      },
      function () {
        checkbox.parentNode.children[1].style.display = 'none'
      }
    )
  } else {
    sfRequest(
      API_PATH +
        '/tooling/query?q=' +
        encodeURI(
          "Select Id From TraceFlag Where TracedEntityId = '" + classId + "'"
        )
    )
      .then(r => r.json())
      .then(function (responseObj) {
        if (responseObj.records.length > 0) {
          const traceFlagId = responseObj.records[0].Id
          sfRequest(
            API_PATH + '/tooling/sobjects/TraceFlag/' + traceFlagId,
            'DELETE'
          ).then(function () {
            checkbox.parentNode.children[1].style.display = 'none'
          })
        }
      })
  }
}

addHeader()
addCheckboxes()
addButton()

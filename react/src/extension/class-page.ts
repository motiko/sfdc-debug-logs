// Content script on the classic Apex class and trigger lists (/01p…,
// allTriggers.apexp): "See All" buttons and a "Dont Log Class" checkbox per
// class, which sets (for 24 hours) or removes a CLASS_TRACING flag whose debug
// level has every log category at NONE.
import { pageSalesforce } from '../core/page-session'

const sf = pageSalesforce()

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
  const link = row.querySelector('th>a')
  // Rows without a class link (e.g. on the "all classes" view) get no toggle.
  if (!link) return
  const clone: any = cell.cloneNode(true)
  const classLink = link.href
  const classId = classLink.slice(classLink.lastIndexOf('/01') + 1)
  // Not every class list layout has the checkbox image column.
  const image = row.querySelector('td>img')
  const isChecked = !!image && image.title === 'Checked'
  clone.firstChild.dataset.classId = classId
  clone.firstChild.onclick = toggleTraceFlag
  clone.firstChild.checked = isChecked
  row.appendChild(clone)
}

function toggleTraceFlag() {
  const checkbox = this
  const loading = checkbox.parentNode.children[1]
  loading.style.display = 'inline'
  sf.setClassLogging(checkbox.dataset.classId, !checkbox.checked)
    .catch(err => {
      console.error('Apex Debugger: changing the class trace flag failed', err)
    })
    .then(() => {
      loading.style.display = 'none'
    })
}

addHeader()
addCheckboxes()
addButton()

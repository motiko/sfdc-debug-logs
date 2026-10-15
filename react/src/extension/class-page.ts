// Content script on the classic Apex class and trigger lists (/01p…,
// allTriggers.apexp): "See all" buttons and a "Don't log" checkbox per class,
// which silences the class for 24 hours (a CLASS_TRACING flag whose debug
// level has every log category at NONE) or lets it log again. Each checkbox
// is labeled with its class (docs/ux/baseline-review.md B6, m14).
import { pageSalesforce } from '../core/page-session'
import { explainError } from '../core/salesforce/errors'
import { h, injectDesignTokens } from './classic-ui'

const sf = pageSalesforce()

const EXPLANATION =
  'Checked: the class writes nothing to debug logs for 24 hours (a CLASS_TRACING trace flag at level NONE). Uncheck to log it again.'

function seeAllButton(label: string, parameter: string) {
  return h('button', {
    type: 'button',
    className: 'apexdbg-button',
    text: label,
    onclick: () => {
      if (location.search.indexOf('rowsperpage=') > -1) {
        window.location.search =
          'setupid=ApexClasses&' + encodeURIComponent(parameter) + '=3500'
      } else {
        window.location.search += '&' + encodeURIComponent(parameter) + '=3500'
      }
    }
  })
}

const toolsSpan = (...children: Node[]) =>
  h(
    'span',
    {
      className: 'apexdbg-root apexdbg-inline-tools',
      dataset: { apexdbgColorMode: 'light' }
    },
    ...children
  )

function addButtons() {
  const classesForm = document.getElementById(
    'all_classes_page:theTemplate:theForm'
  )
  const classesCell = classesForm && classesForm.querySelector('td')
  if (classesCell) {
    classesCell.appendChild(
      toolsSpan(
        seeAllButton(
          'See all classes',
          'all_classes_page:theTemplate:classList:rowsperpage'
        )
      )
    )
  }
  const developerConsole = document.querySelector(
    'input[value="Developer Console"]'
  )
  if (developerConsole) {
    developerConsole.parentNode.appendChild(
      toolsSpan(
        seeAllButton(
          'See all triggers',
          'all_triggers_page:theTemplate:j_id41:rowsperpage'
        )
      )
    )
  }
}

const status = () => document.getElementById('apexdbgDontLogStatus')

function addHeader() {
  const headerRow = document.querySelector('.headerRow')
  if (!headerRow) return false
  const selectAll = h('input', {
    type: 'checkbox',
    id: 'apexdbgDontLogAll',
    title: EXPLANATION
  })
  selectAll.setAttribute('aria-label', 'Don’t log any class on this page')
  selectAll.addEventListener('click', () => {
    document.querySelectorAll<HTMLInputElement>('.dontLog').forEach(box => {
      if (box.checked !== selectAll.checked) box.click()
    })
  })
  const header = h(
    'th',
    {
      className: 'apexdbg-root apexdbg-dont-log',
      dataset: { apexdbgColorMode: 'light' }
    },
    h(
      'span',
      { className: 'apexdbg-check' },
      selectAll,
      h('span', { text: 'Don’t log (24 h)', title: EXPLANATION })
    ),
    h('span', {
      id: 'apexdbgDontLogStatus',
      className: 'apexdbg-status-line',
      attrs: { role: 'status' }
    })
  )
  headerRow.appendChild(header)
  return true
}

function addCheckbox(row: HTMLElement) {
  const link = row.querySelector<HTMLAnchorElement>('th>a')
  // Rows without a class link (e.g. on the "all classes" view) get no toggle.
  if (!link) return
  const classLink = link.href
  const classId = classLink.slice(classLink.lastIndexOf('/01') + 1)
  const className = link.textContent.trim()
  // Not every class list layout has the checkbox image column.
  const image = row.querySelector<HTMLImageElement>('td>img')
  const checkbox = h('input', {
    type: 'checkbox',
    className: 'dontLog',
    checked: !!image && image.title === 'Checked',
    title: EXPLANATION,
    dataset: { classId }
  })
  checkbox.setAttribute('aria-label', `Don’t log ${className}`)
  checkbox.addEventListener('click', () => toggleTraceFlag(checkbox, className))
  row.appendChild(
    h(
      'td',
      {
        className: 'apexdbg-root apexdbg-dont-log',
        dataset: { apexdbgColorMode: 'light' }
      },
      checkbox
    )
  )
}

function toggleTraceFlag(checkbox: HTMLInputElement, className: string) {
  const silence = checkbox.checked
  checkbox.disabled = true
  checkbox.setAttribute('aria-busy', 'true')
  sf.setClassLogging(checkbox.dataset.classId, !silence)
    .then(() => {
      status().textContent = silence
        ? `${className} won’t be logged for 24 hours.`
        : `${className} is logged again.`
    })
    .catch(err => {
      console.error('Apex Debugger: changing the class trace flag failed', err)
      checkbox.checked = !silence
      const explained = explainError(err, location.hostname)
      status().textContent = `Couldn’t change logging for ${className}. ${explained.title}`
      checkbox.title = status().textContent
    })
    .then(() => {
      checkbox.disabled = false
      checkbox.removeAttribute('aria-busy')
    })
}

injectDesignTokens()
if (addHeader()) {
  document
    .querySelectorAll<HTMLElement>('.dataRow')
    .forEach(row => addCheckbox(row))
}
addButtons()

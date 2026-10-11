// Options page (html/options.html): edit the keyboard shortcuts
// (chrome.storage.sync `shortcuts`) and save a session id for orgs whose sid
// cookie can't be read (chrome.storage.local `token`).
import { defaultShortcuts, type Shortcut } from '../core/default-shortcuts'

const $i = (id: string): any => document.getElementById(id)

function initOptions() {
  const shortcutsTable = $i('shortcutsTable')
  $i('save_btn').addEventListener('click', save)
  $i('restore_defaults_btn').addEventListener('click', () => {
    chrome.storage.sync.set({ shortcuts: defaultShortcuts })
  })
  $i('new_btn').addEventListener('click', () => {
    shortcutsTable.appendChild(newShortcutLine())
  })
  chrome.storage.local.get('token').then(({ token }) => {
    if (token) {
      const tokenElement: HTMLInputElement =
        document.querySelector('.token_val')
      tokenElement.value = token as string
    }
  })
  chrome.storage.sync.get('shortcuts').then(({ shortcuts }) => {
    const shortcutLines = buildShortcuts(shortcuts as Shortcut[] | undefined)
    for (const line of shortcutLines) {
      shortcutsTable.appendChild(line)
    }
    document.querySelectorAll('.remove_btn').forEach(removeBtnNode => {
      removeBtnNode.addEventListener('click', removeShortcutLine)
    })
  })
}

function removeShortcutLine(event: any) {
  const tr = event.target.parentNode.parentNode
  tr.parentNode.removeChild(tr)
}

function newShortcutLine(): HTMLElement {
  const template = $i('templateKeyOption').cloneNode(true)
  template.hidden = false
  template.id = undefined
  template
    .querySelector('.remove_btn')
    .addEventListener('click', removeShortcutLine)
  return template
}

function buildShortcuts(shortcuts: Shortcut[] = defaultShortcuts) {
  return shortcuts.map(shortcut => {
    const template = newShortcutLine()
    template.querySelector<HTMLInputElement>('.val_name').value = shortcut.name
    template.querySelector<HTMLInputElement>('.val_key').value = shortcut.key
    if (shortcut.path !== undefined) {
      template.querySelector<HTMLInputElement>('.val_path').value =
        shortcut.path
    } else {
      template
        .querySelector('.val_path')
        .parentNode.removeChild(template.querySelector('.val_path'))
    }
    if (shortcut.app) {
      template
        .querySelector('.remove_btn')
        .parentNode.removeChild(template.querySelector('.remove_btn'))
    }
    if (shortcut.token) {
      template
        .querySelector('.remove_btn')
        .parentNode.removeChild(template.querySelector('.remove_btn'))
      const key = template.querySelector('.val_key')
      key.parentNode.removeChild(key)
      const path = template.querySelector<HTMLInputElement>('.val_path')
      path.required = false
      path.placeholder = 'API Token'
      path.classList.add('token_val')
    }
    return template
  })
}

function save(event: any) {
  const form = $i('shortcutsForm')
  if (!form.checkValidity()) {
    const targetClassList = event.target.classList
    if (targetClassList.contains('shake-btn')) {
      targetClassList.remove('shake-btn')
      void event.target.offsetWidth // hack to restart animation (forces reflow)
    }
    targetClassList.add('shake-btn')
    event.preventDefault()
    return
  }
  const toSetting = (trNode: Element): Shortcut | null => {
    const pathInput = trNode.querySelector<HTMLInputElement>('.val_path')
    const name = trNode.querySelector<HTMLInputElement>('.val_name').value
    if (name === 'Token') {
      // Token rows have no key input.
      return null
    }
    const key = trNode.querySelector<HTMLInputElement>('.val_key').value
    if (!pathInput) {
      return { app: true, name, key }
    }
    let path = pathInput.value
    path = path[0] == '/' ? path : '/' + path
    return { name, key, path }
  }
  const shortcuts = [...document.getElementById('shortcutsTable').children]
  const tokenElement: HTMLInputElement = document.querySelector('.token_val')
  const token = tokenElement ? tokenElement.value : null
  chrome.storage.local.set({ token })
  chrome.storage.sync.set({
    shortcuts: shortcuts.map(toSetting).filter(x => x)
  })
}

initOptions()

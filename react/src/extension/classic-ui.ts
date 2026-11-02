// Shared by the content scripts that add controls to classic Salesforce pages
// (debug-log-page.ts, debug-log-list.ts, class-page.ts): the design tokens as
// CSS custom properties, the user's color mode, page-shortcut settings, and a
// small DOM builder. The look is in chrome/app/css/classic.css, scoped to
// .apexdbg-root so Salesforce's own controls keep theirs.
//
// Everything here builds DOM with elements and textContent: page and log
// data never goes through innerHTML.
import { designTokensCss } from '../ui/tokens'
import { keyLabel, keySpokenNames } from '../core/key-labels'
import {
  colorModeAttribute,
  onSharedAppearanceChange,
  readSharedAppearance
} from '../core/shared-appearance'
import type { ColorModePreference } from '../ui/tokens'
import type { PageShortcutSettings } from '../core/page-shortcuts'

// Defines the --ad-* tokens on every .apexdbg-root (light, or dark with the OS, or
// forced with data-apexdbg-color-mode), once per page.
export function injectDesignTokens() {
  if (document.getElementById('apexdbg-design-tokens')) return
  const style = document.createElement('style')
  style.id = 'apexdbg-design-tokens'
  style.textContent = designTokensCss('.apexdbg-root')
  document.head.appendChild(style)
}

// Keeps `root` in the user's color mode (the app's and the options page's
// setting), now and when it changes. Calls onChange with the mode it resolves
// to ('light' or 'dark').
export function followColorMode(
  root: HTMLElement,
  onChange: (mode: 'light' | 'dark') => void = () => {}
) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  let preference: ColorModePreference = 'system'
  const apply = () => {
    const forced = colorModeAttribute(preference)
    if (forced) root.dataset.apexdbgColorMode = forced
    else delete root.dataset.apexdbgColorMode
    onChange(forced || (media.matches ? 'dark' : 'light'))
  }
  apply()
  media.addEventListener('change', apply)
  readSharedAppearance().then(({ colorMode }) => {
    preference = colorMode
    apply()
  })
  onSharedAppearanceChange(({ colorMode }) => {
    preference = colorMode
    apply()
  })
}

// The user's page shortcut settings (from the service worker, like
// shortcuts.ts), or null if the worker doesn't answer.
export async function pageShortcutSettings(): Promise<PageShortcutSettings | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      command: 'getShortcuts'
    })
    return (response && response.settings) || null
  } catch {
    return null
  }
}

type Child = Node | string | null | undefined | false
type Props = Record<string, unknown> & {
  className?: string
  text?: string
  attrs?: Record<string, string>
  dataset?: Record<string, string>
}

// A small element builder: h('button', { className: 'apexdbg-button', text: 'Go',
// onclick }, child, …). `text` sets textContent; `attrs` sets attributes
// (aria-*, for, role); other keys are assigned as properties.
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  const { text, attrs, dataset, ...rest } = props
  Object.assign(element, rest)
  if (attrs) {
    for (const [name, value] of Object.entries(attrs))
      element.setAttribute(name, value)
  }
  if (dataset) Object.assign(element.dataset, dataset)
  if (text !== undefined) element.textContent = text
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    element.append(child)
  }
  return element
}

// A labeled checkbox: <label class="apexdbg-check"><input id> Text</label>.
export function checkbox(
  id: string,
  label: string,
  checked: boolean,
  onchange: (checked: boolean) => void,
  shortcut?: string
): HTMLLabelElement {
  const input = h('input', { type: 'checkbox', id, checked })
  if (shortcut) input.setAttribute('aria-keyshortcuts', shortcut)
  input.addEventListener('change', () => onchange(input.checked))
  return h('label', { className: 'apexdbg-check', htmlFor: id }, input, label)
}

// A labeled select: <span class="apexdbg-field"><label for>…</label><select id>.
export function select(
  id: string,
  label: string,
  options: { value: string; label: string }[],
  value: string,
  onchange: (value: string) => void
): HTMLSpanElement {
  const element = h(
    'select',
    { id },
    ...options.map(o => h('option', { value: o.value, text: o.label }))
  )
  element.value = value
  element.addEventListener('change', () => onchange(element.value))
  return h(
    'span',
    { className: 'apexdbg-field' },
    h('label', { htmlFor: id, text: label }),
    element
  )
}

// Keys as <kbd> elements: "Shift+e" -> Shift E (⇧ E on macOS). Symbols are
// hidden from screen readers, which read their names instead.
export function keysElement(keys: string): HTMLSpanElement {
  const spoken = keySpokenNames(keys)
  return h(
    'span',
    { className: 'apexdbg-keys' },
    ...keyLabel(keys).map((part, i) =>
      spoken[i]
        ? h(
            'kbd',
            {},
            h('span', {
              text: part,
              className: part.length === 1 ? 'apexdbg-key-symbol' : '',
              attrs: { 'aria-hidden': 'true' }
            }),
            h('span', { className: 'apexdbg-sr-only', text: spoken[i] })
          )
        : h('kbd', { text: part })
    )
  )
}

// localStorage of the Salesforce page; it can throw (blocked site data).
export const pageStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // The setting then lasts only as long as the page.
    }
  }
}

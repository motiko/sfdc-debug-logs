import { describe, expect, it } from 'vitest'
import { isMac, keyLabel, keyText, modKeyName } from './key-labels'

describe('key labels', () => {
  it('tells macOS from other platforms', () => {
    expect(isMac('MacIntel')).toBe(true)
    expect(isMac('Win32')).toBe(false)
    expect(isMac('Linux x86_64')).toBe(false)
  })

  it('shows macOS modifier symbols', () => {
    expect(keyLabel('Mod+f', true)).toEqual(['⌘', 'F'])
    expect(keyLabel('Alt+Shift+d', true)).toEqual(['⌥', '⇧', 'D'])
    expect(keyLabel('Shift+Enter', true)).toEqual(['⇧', 'Enter'])
    expect(keyText('Alt+Shift+d', true)).toBe('⌥⇧D')
    expect(keyText('Mod+s', true)).toBe('⌘S')
    expect(modKeyName(true)).toBe('⌘')
  })

  it('names modifiers elsewhere', () => {
    expect(keyLabel('Mod+f', false)).toEqual(['Ctrl', 'F'])
    expect(keyLabel('Alt+Shift+d', false)).toEqual(['Alt', 'Shift', 'D'])
    expect(keyText('Alt+Shift+d', false)).toBe('Alt+Shift+D')
    expect(keyText('Mod+s', false)).toBe('Ctrl+S')
    expect(modKeyName(false)).toBe('Ctrl')
  })

  it('shows single keys and named keys', () => {
    expect(keyLabel('?', true)).toEqual(['?'])
    expect(keyLabel('r', false)).toEqual(['R'])
    expect(keyLabel('Escape', false)).toEqual(['Esc'])
    expect(keyLabel('ArrowDown', true)).toEqual(['↓'])
  })
})

describe('spoken key names', () => {
  it('names symbols for screen readers', async () => {
    const { keySpokenNames } = await import('./key-labels')
    expect(keySpokenNames('Alt+Shift+d', true)).toEqual([
      'Option',
      'Shift',
      null
    ])
    expect(keySpokenNames('Mod+s', true)).toEqual(['Command', null])
    expect(keySpokenNames('Mod+s', false)).toEqual([null, null])
    expect(keySpokenNames('ArrowDown', false)).toEqual(['Down arrow'])
  })
})

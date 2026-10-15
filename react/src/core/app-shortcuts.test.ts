import { describe, expect, it } from 'vitest'
import {
  APP_SHORTCUTS,
  keyLabel,
  matchesKey,
  shortcutFor,
  shortcutHint
} from './app-shortcuts'

const key = (k: string, mods: object = {}) => ({ key: k, ...mods })

describe('app shortcuts', () => {
  it('has no shortcut that deletes anything', () => {
    for (const s of APP_SHORTCUTS)
      expect(s.description).not.toMatch(/delete|remove/i)
    expect(APP_SHORTCUTS.some(s => s.keys.includes('a'))).toBe(false)
  })

  it('matches typed characters, including shifted ones', () => {
    expect(matchesKey(key('?', { shiftKey: true }), '?')).toBe(true)
    expect(matchesKey(key('R', { shiftKey: true }), 'R')).toBe(true)
    expect(matchesKey(key('r'), 'R')).toBe(false)
    expect(matchesKey(key('j', { ctrlKey: true }), 'j', false)).toBe(false)
  })

  it('needs the platform modifier for Mod', () => {
    expect(matchesKey(key('f', { metaKey: true }), 'Mod+f', true)).toBe(true)
    expect(matchesKey(key('f', { ctrlKey: true }), 'Mod+f', false)).toBe(true)
    expect(matchesKey(key('f', { ctrlKey: true }), 'Mod+f', true)).toBe(false)
    expect(matchesKey(key('f'), 'Mod+f', false)).toBe(false)
  })

  it('needs exactly the named modifiers for named keys', () => {
    expect(matchesKey(key('Enter', { shiftKey: true }), 'Shift+Enter')).toBe(
      true
    )
    expect(matchesKey(key('Enter', { shiftKey: true }), 'Enter')).toBe(false)
  })

  it('finds the shortcut among the active ones', () => {
    expect(shortcutFor(key('e'), ['nextError', 'nextDebug'])).toBe('nextError')
    expect(shortcutFor(key('e'), ['nextDebug'])).toBe(null)
    expect(shortcutFor(key(']'), ['nextLog', 'previousLog'])).toBe('nextLog')
  })

  it('labels keys for the help overlay and tooltips', () => {
    expect(keyLabel('Mod+f', true)).toEqual(['⌘', 'F'])
    expect(keyLabel('Mod+f', false)).toEqual(['Ctrl', 'F'])
    expect(shortcutHint('refresh')).toBe('R')
    expect(keyLabel('+')).toEqual(['+'])
    expect(keyLabel('ArrowLeft')).toEqual(['←'])
  })

  it('handles the plus key', () => {
    expect(matchesKey(key('+', { shiftKey: true }), '+')).toBe(true)
    expect(matchesKey(key('-'), '+')).toBe(false)
    expect(shortcutFor(key('='), ['timelineZoomIn'])).toBe('timelineZoomIn')
  })

  it('lists the call tree and timeline keys', () => {
    const groups = new Set(APP_SHORTCUTS.map(s => s.group))
    expect(groups.has('Call tree')).toBe(true)
    expect(groups.has('Timeline')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  EXTENSION_CONTEXT_LOST,
  ExtensionContextLostError,
  extensionContextAlive,
  requireExtensionContext
} from './extension-context'

describe('extensionContextAlive', () => {
  it('is true while chrome.runtime has the extension id', () => {
    expect(extensionContextAlive({ runtime: { id: 'abcdefghijklmnop' } })).toBe(
      true
    )
  })

  it('is false once the extension was reloaded (chrome.runtime gone)', () => {
    expect(extensionContextAlive({})).toBe(false)
    expect(extensionContextAlive(undefined)).toBe(false)
  })

  it('is false when chrome.runtime lost its id', () => {
    expect(extensionContextAlive({ runtime: {} })).toBe(false)
    expect(extensionContextAlive({ runtime: { id: undefined } })).toBe(false)
  })
})

describe('requireExtensionContext', () => {
  it('passes while the extension is reachable', () => {
    expect(() =>
      requireExtensionContext({ runtime: { id: 'abcdefghijklmnop' } })
    ).not.toThrow()
  })

  it('throws an error that tells the user to reload the page', () => {
    expect(() => requireExtensionContext({})).toThrow(ExtensionContextLostError)
    expect(() => requireExtensionContext({})).toThrow(EXTENSION_CONTEXT_LOST)
  })
})

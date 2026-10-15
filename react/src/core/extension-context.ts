// Whether a content script can still talk to its extension. Reloading or
// updating the extension cuts the scripts already running in open tabs off
// from the extension APIs (chrome.runtime disappears or loses its id) while
// their key bindings and buttons stay on the page; Chrome does not inject the
// new scripts into those tabs, so only a page reload helps.

export const EXTENSION_CONTEXT_LOST =
  'Apex Debugger was updated or reloaded. Reload this page to use it again.'

export class ExtensionContextLostError extends Error {
  constructor() {
    super(EXTENSION_CONTEXT_LOST)
    this.name = 'ExtensionContextLostError'
  }
}

type ChromeLike = { runtime?: { id?: unknown } } | undefined

export function extensionContextAlive(
  chromeApi: ChromeLike = (globalThis as any).chrome
): boolean {
  return Boolean(
    chromeApi && chromeApi.runtime && typeof chromeApi.runtime.id === 'string'
  )
}

// Throws ExtensionContextLostError when the extension is gone.
export function requireExtensionContext(chromeApi?: ChromeLike): void {
  if (!extensionContextAlive(chromeApi)) throw new ExtensionContextLostError()
}

// The app's two screens, addressed by the URL hash: the log list (#/) and a
// log (#/logs/<id>). A hook instead of a router library, for two routes.
import { useSyncExternalStore } from 'react'

// The log id in a hash like "#/logs/07L…", or null for the log list.
export function logIdFromHash(hash: string): string | null {
  const match = /^#?\/logs\/([^/?#]+)/.exec(hash)
  return match ? decodeURIComponent(match[1]) : null
}

export function logHash(logId: string | null): string {
  return logId ? `#/logs/${encodeURIComponent(logId)}` : '#/'
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// The id of the log the URL shows, or null; follows hash changes (links,
// the back button, or code setting location.hash).
export function useOpenLogId(): string | null {
  return useSyncExternalStore(subscribe, () => logIdFromHash(location.hash))
}

export function openLog(logId: string | null): void {
  location.hash = logHash(logId)
}

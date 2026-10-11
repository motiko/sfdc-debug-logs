// The app's color mode: the user's preference ('system', 'light', 'dark'),
// resolved against the OS setting (prefers-color-scheme), and kept up to date
// when the OS setting changes.
import { useEffect, useSyncExternalStore } from 'react'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

function subscribe(onChange) {
  const media = query()
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useSystemColorMode() {
  return useSyncExternalStore(subscribe, () =>
    query().matches ? 'dark' : 'light'
  )
}

// 'light' or 'dark'. Also marks the document (data-ad-color-mode and the CSS
// color-scheme), so native controls and scrollbars match.
export function useResolvedColorMode(preference) {
  const system = useSystemColorMode()
  const mode =
    preference === 'light' || preference === 'dark' ? preference : system
  useEffect(() => {
    const root = document.documentElement
    root.dataset.adColorMode = mode
    root.style.colorScheme = mode
  }, [mode])
  return mode
}

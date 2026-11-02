import { useEffect, useRef } from 'react'
import { shortcutFor } from '../../core/app-shortcuts'

const isEditable = el =>
  el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

// Binds the app's keyboard shortcuts (core/app-shortcuts.ts) on the
// document. Keys typed in a field, a menu or a dialog are left alone, except
// Ctrl/Cmd+F, which focuses the log's find field (pressed there again, the
// browser's own find opens). Handlers come from the page.
export function useAppShortcuts(options) {
  const latest = useRef(options)
  latest.current = options

  useEffect(() => {
    const onKeyDown = event => {
      const o = latest.current
      if (event.defaultPrevented || !o.enabled) return
      const target = event.target
      const logIds = o.logOpen
        ? [
            'find',
            'nextLog',
            'previousLog',
            'nextError',
            'nextDebug',
            'download'
          ]
        : []
      if (o.logOpen && shortcutFor(event, ['find']) === 'find') {
        if (o.isFindFocused()) return
        event.preventDefault()
        o.onFind()
        return
      }
      if (
        isEditable(target) ||
        (target.closest &&
          target.closest('[role=menu],[role=dialog],[role=listbox]'))
      ) {
        return
      }
      if (
        o.logOpen &&
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        o.onClose()
        return
      }
      const id = shortcutFor(event, [
        'help',
        'search',
        'refresh',
        'nextRow',
        'previousRow',
        ...logIds
      ])
      // Arrows belong to the focused control (the list grid, the log body).
      if (!id || event.key.startsWith('Arrow')) return
      event.preventDefault()
      const actions = {
        help: o.onHelp,
        search: o.onSearch,
        refresh: o.onRefresh,
        nextRow: () => o.onRow(1),
        previousRow: () => o.onRow(-1),
        nextLog: () => o.onLog(1),
        previousLog: () => o.onLog(-1),
        nextError: o.onNextError,
        nextDebug: o.onNextDebug,
        download: o.onDownload
      }
      if (actions[id]) actions[id]()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

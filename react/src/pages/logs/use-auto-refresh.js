import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { pollNewLogs } from './actions'
import { autoRefreshState, createPoller } from './auto-refresh'

// Whether the app's tab is in front (document.visibilityState).
export function usePageVisible() {
  const [visible, setVisible] = useState(
    () => document.visibilityState === 'visible'
  )
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

// Runs the list's auto-refresh (auto-refresh.ts) while the user chose an
// interval, their logging is on and the tab is visible, and only after the
// list's first load. openId: the open log, never dropped from the list.
// Returns the state for the control, and the last poll's announcement for
// a polite live region ({ key, text }: the key changes for each one).
export function useAutoRefresh({ openId }) {
  const dispatch = useDispatch()
  const interval = useSelector(state => state.logsPage.autoRefresh)
  const logging = useSelector(state => state.logsPage.logging)
  const loadedAt = useSelector(state => state.logsPage.loadedAt)
  const visible = usePageVisible()
  const [failing, setFailing] = useState(false)
  const [announcement, setAnnouncement] = useState(null)
  // Re-evaluated when the trace flag expires while the page is open.
  const [, setExpiredAt] = useState(0)
  const openIdRef = useRef(openId)
  useEffect(() => {
    openIdRef.current = openId
  }, [openId])

  const [poller] = useState(() =>
    createPoller({
      poll: async () => {
        const added = await dispatch(pollNewLogs({ keepId: openIdRef.current }))
        if (added > 0) {
          setAnnouncement(a => ({
            key: (a ? a.key : 0) + 1,
            text: added === 1 ? '1 new log' : `${added} new logs`
          }))
        }
        return added
      },
      onFailuresChange: n => setFailing(n > 0)
    })
  )

  const state = autoRefreshState({ interval, logging, visible })

  useEffect(() => {
    const expires = Date.parse(logging.expiresAt || '')
    if (logging.status !== 'on' || isNaN(expires)) return
    const wait = expires - Date.now()
    if (wait <= 0 || wait > 2 ** 31 - 1) return
    const timer = setTimeout(() => setExpiredAt(Date.now()), wait + 1000)
    return () => clearTimeout(timer)
  }, [logging.status, logging.expiresAt])

  useEffect(() => {
    poller.update({
      run: state === 'running' && loadedAt !== null,
      intervalMs: interval * 1000,
      lastLoadedAt: loadedAt
    })
  }, [poller, state, interval, loadedAt])

  useEffect(() => () => poller.stop(), [poller])

  return {
    state,
    interval,
    failing: state === 'running' && failing,
    announcement
  }
}

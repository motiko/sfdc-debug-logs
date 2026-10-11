import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography
} from '@mui/material'
import ShortcutList from '../../../ui/components/shortcut-list'
import { APP_SHORTCUTS } from '../../../core/app-shortcuts'
import { isMac } from '../../../core/key-labels'
import {
  describePageShortcuts,
  loadPageShortcuts
} from '../../../core/page-shortcuts'

const GROUPS = ['General', 'Log list', 'Log']

// The user's shortcuts on Salesforce pages (null until read, or when the
// page can't read extension storage).
function usePageShortcuts(open) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    if (!open || typeof chrome === 'undefined' || !chrome.storage) return
    let current = true
    loadPageShortcuts(chrome.storage.sync).then(
      settings => current && setItems(describePageShortcuts(settings)),
      () => {}
    )
    return () => {
      current = false
    }
  }, [open])
  return items
}

// "?": every keyboard shortcut of the app, grouped, then the user's shortcuts
// on Salesforce pages (core/page-shortcuts.ts, the same registry the content
// scripts bind and the options page edits).
export default function ShortcutsDialog({ open, onClose }) {
  const pageShortcuts = usePageShortcuts(open)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="shortcuts-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="shortcuts-title">Keyboard shortcuts</DialogTitle>
      <DialogContent>
        {GROUPS.map(group => (
          <ShortcutList
            key={group}
            title={group}
            items={APP_SHORTCUTS.filter(s => s.group === group)}
          />
        ))}
        {pageShortcuts ? (
          <ShortcutList title="On Salesforce pages" items={pageShortcuts} />
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          None of these shortcuts deletes anything. On Salesforce pages, add{' '}
          {isMac() ? '⌥ (Option)' : 'Alt'} to open a page in the same tab. On
          any Salesforce tab, the Apex Debugger button in the browser toolbar
          opens this log viewer too.
        </Typography>
        <Typography variant="body2">
          <Link href="options.html#shortcuts" target="_blank" rel="noreferrer">
            Change or turn off the page shortcuts in the extension options
          </Link>
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

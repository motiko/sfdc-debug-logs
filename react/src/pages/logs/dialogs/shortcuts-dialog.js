import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography
} from '@mui/material'
import Keys from '../../../ui/components/kbd'
import { APP_SHORTCUTS, keyLabel } from '../../../core/app-shortcuts'

const GROUPS = ['General', 'Log list', 'Log']

// "r" and "R" both show as R: list each label once.
const uniqueKeys = keys => {
  const seen = new Set()
  return keys.filter(k => {
    const label = keyLabel(k).join('+')
    if (seen.has(label)) return false
    seen.add(label)
    return true
  })
}

// "?": every keyboard shortcut of the app, grouped, plus where to change the
// shortcuts that work on Salesforce pages.
export default function ShortcutsDialog({ open, onClose }) {
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
          <Box key={group} component="section" sx={{ mb: 2 }}>
            <Typography component="h3" variant="h3" sx={{ mb: 0.5 }}>
              {group}
            </Typography>
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: '220px 1fr',
                gap: '6px 16px',
                m: 0
              }}
            >
              {APP_SHORTCUTS.filter(s => s.group === group).map(s => (
                <Box key={s.id} sx={{ display: 'contents' }}>
                  <Box
                    component="dt"
                    sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
                  >
                    {uniqueKeys(s.keys).map((k, i) => (
                      <span key={k}>
                        {i > 0 ? (
                          <span style={{ marginRight: 6 }}>or</span>
                        ) : null}
                        <Keys keys={k} />
                      </span>
                    ))}
                  </Box>
                  <Box component="dd" sx={{ m: 0, fontSize: 13 }}>
                    {s.description}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
        <Typography variant="body2" color="text.secondary">
          None of these shortcuts deletes anything. On Salesforce pages,{' '}
          <Keys keys="Shift+W" /> opens this app; change the page shortcuts in
          the{' '}
          <Link href="options.html" target="_blank" rel="noreferrer">
            extension options
          </Link>
          .
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

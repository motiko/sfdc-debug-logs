import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import IconAction from '../ui/components/icon-action'
import Keys from '../ui/components/kbd'
import ShortcutList from '../ui/components/shortcut-list'
import Section from './section'
import {
  ACTION_DESCRIPTIONS,
  bindingsFor,
  CLASSIC_LOG_LIST_SHORTCUTS,
  CLASSIC_LOG_PAGE_SHORTCUTS,
  defaultPageShortcutSettings,
  loadPageShortcuts,
  newShortcutId,
  normalizePath,
  SHORTCUTS_STORAGE_KEY,
  validateShortcuts
} from '../core/page-shortcuts'
import { APP_SHORTCUTS } from '../core/app-shortcuts'

const EFFECT_TEXT = { newTab: 'new tab', sameTab: 'same tab', run: '' }

// What gets saved: trimmed names, paths starting with "/".
function normalized(settings) {
  return {
    ...settings,
    shortcuts: settings.shortcuts.map(s =>
      s.action ? s : { ...s, name: s.name.trim(), path: normalizePath(s.path) }
    )
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function save(settings) {
  return chrome.storage.sync.set({ [SHORTCUTS_STORAGE_KEY]: settings })
}

// The key combinations a shortcut gets, next to its key field.
function Combos({ shortcut }) {
  const bindings = bindingsFor(shortcut)
  if (!bindings.length) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        Off
      </Typography>
    )
  }
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 12 }}
    >
      {bindings.map(b => (
        <Box
          key={b.combo}
          sx={{
            display: 'flex',
            gap: 0.75,
            alignItems: 'center',
            whiteSpace: 'nowrap'
          }}
        >
          <Keys keys={b.keys} />
          {EFFECT_TEXT[b.effect] ? (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {EFFECT_TEXT[b.effect]}
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  )
}

// Keyboard shortcuts on Salesforce pages (core/page-shortcuts.ts): turn them
// on or off, change keys, add and remove page shortcuts, with conflicts and
// mistakes reported on the field, an explicit Save with a status, and
// Restore defaults behind a confirmation, with Undo (baseline review B7, M12,
// M13, M15).
export default function ShortcutsSettings() {
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const tableRef = useRef(null)

  useEffect(() => {
    loadPageShortcuts(chrome.storage.sync).then(settings => {
      setSaved(settings)
      setDraft(settings)
    })
  }, [])

  // Moves focus to a field once it's rendered (a new row, the first problem).
  useEffect(() => {
    if (!focusId || !tableRef.current) return
    const field = tableRef.current.querySelector(`[data-field="${focusId}"]`)
    if (field) field.focus()
    setFocusId(null)
  }, [focusId, draft])

  const problems = useMemo(
    () => (draft ? validateShortcuts(draft.shortcuts) : []),
    [draft]
  )

  if (!draft) {
    return (
      <Section id="shortcuts" title="Keyboard shortcuts">
        <Typography variant="body2" role="status">
          Loading your shortcuts…
        </Typography>
      </Section>
    )
  }

  const dirty = !same(normalized(draft), saved)
  const problemFor = (id, field) =>
    problems.find(p => p.id === id && p.field === field)
  const change = (id, patch) => {
    setStatus(null)
    setDraft(d => ({
      ...d,
      shortcuts: d.shortcuts.map(s => (s.id === id ? { ...s, ...patch } : s))
    }))
  }
  const remove = shortcut => {
    setStatus(null)
    const index = draft.shortcuts.indexOf(shortcut)
    const rest = draft.shortcuts.filter(s => s !== shortcut)
    setDraft({ ...draft, shortcuts: rest })
    // Keep keyboard users in the table: the next row's remove button, or the
    // add button.
    const next = rest[index] || rest[index - 1]
    setFocusId(next && !next.action ? `${next.id}-remove` : 'add')
  }
  const add = () => {
    setStatus(null)
    const id = newShortcutId(draft.shortcuts)
    setDraft({
      ...draft,
      shortcuts: [...draft.shortcuts, { id, name: '', key: '', path: '' }]
    })
    setFocusId(`${id}-name`)
  }
  const onSave = async () => {
    if (problems.length) {
      setStatus({
        severity: 'error',
        message:
          problems.length === 1
            ? 'One shortcut needs a fix before saving (see the highlighted field).'
            : `${problems.length} shortcuts need a fix before saving (see the highlighted fields).`
      })
      setFocusId(`${problems[0].id}-${problems[0].field}`)
      return
    }
    const next = normalized(draft)
    try {
      await save(next)
      setSaved(next)
      setDraft(next)
      setStatus({
        severity: 'success',
        message: 'Shortcuts saved. Open Salesforce pages use them right away.'
      })
    } catch (err) {
      setStatus({ severity: 'error', message: `Couldn’t save: ${err.message}` })
    }
  }
  const restoreDefaults = async () => {
    setConfirmRestore(false)
    const previous = saved
    const defaults = defaultPageShortcutSettings()
    await save(defaults)
    setSaved(defaults)
    setDraft(defaults)
    setStatus({
      severity: 'success',
      message: 'Default shortcuts restored.',
      undo: previous
    })
  }
  const undo = async previous => {
    await save(previous)
    setSaved(previous)
    setDraft(previous)
    setStatus({ severity: 'success', message: 'Your shortcuts are back.' })
  }

  return (
    <Section
      id="shortcuts"
      title="Keyboard shortcuts"
      intro="Shortcuts that work on Salesforce pages while no field has focus. Shift + a letter opens a page in a new tab; Alt + Shift + the letter opens it in this tab."
    >
      <FormControlLabel
        control={
          <Switch
            checked={draft.enabled}
            onChange={e => {
              setStatus(null)
              setDraft({ ...draft, enabled: e.target.checked })
            }}
          />
        }
        label="Use keyboard shortcuts on Salesforce pages"
      />
      {!draft.enabled ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
          Off: only “Open Apex Debugger” works, and the classic debug log pages
          bind no keys.
        </Typography>
      ) : null}

      <Box ref={tableRef} sx={{ overflowX: 'auto' }}>
        <Table
          size="small"
          aria-label="Shortcuts on Salesforce pages"
          sx={{ minWidth: 640 }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '24%' }}>Shortcut</TableCell>
              <TableCell sx={{ width: 230 }}>Key</TableCell>
              <TableCell>Opens or does</TableCell>
              <TableCell sx={{ width: 48 }}>
                <span className="sr-only">Remove</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.shortcuts.map(shortcut => {
              const label = shortcut.name || 'new shortcut'
              const keyProblem = problemFor(shortcut.id, 'key')
              const pathProblem = problemFor(shortcut.id, 'path')
              return (
                <TableRow key={shortcut.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell>
                    {shortcut.action ? (
                      <Typography
                        variant="body2"
                        sx={{ pt: 0.75, fontWeight: 600 }}
                      >
                        {shortcut.name}
                      </Typography>
                    ) : (
                      <TextField
                        fullWidth
                        value={shortcut.name}
                        placeholder="e.g. Accounts"
                        onChange={e =>
                          change(shortcut.id, { name: e.target.value })
                        }
                        slotProps={{
                          htmlInput: {
                            'aria-label': 'Shortcut name',
                            'data-field': `${shortcut.id}-name`
                          }
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                    >
                      <TextField
                        value={shortcut.key.toUpperCase()}
                        error={Boolean(keyProblem)}
                        onChange={e => {
                          const typed = e.target.value.slice(-1).toLowerCase()
                          change(shortcut.id, { key: typed })
                        }}
                        onFocus={e => e.target.select()}
                        sx={{ width: 56, flex: 'none' }}
                        slotProps={{
                          htmlInput: {
                            'aria-label': `Key for ${label}`,
                            'aria-invalid': Boolean(keyProblem),
                            'aria-describedby': keyProblem
                              ? `${shortcut.id}-key-problem`
                              : undefined,
                            'data-field': `${shortcut.id}-key`,
                            maxLength: 2,
                            autoComplete: 'off',
                            spellCheck: false,
                            style: {
                              textAlign: 'center',
                              fontFamily: 'var(--ad-font-mono)'
                            }
                          }
                        }}
                      />
                      <Box sx={{ pt: 0.5 }}>
                        <Combos shortcut={shortcut} />
                      </Box>
                    </Box>
                    {keyProblem ? (
                      <Typography
                        id={`${shortcut.id}-key-problem`}
                        variant="caption"
                        sx={{ color: 'error.main', display: 'block', mt: 0.5 }}
                      >
                        {keyProblem.message}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {shortcut.action ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ pt: 0.75 }}
                      >
                        {ACTION_DESCRIPTIONS[shortcut.action]}
                      </Typography>
                    ) : (
                      <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        value={shortcut.path}
                        placeholder="Path, e.g. /001 or /lightning/setup/ApexClasses/home"
                        error={Boolean(pathProblem)}
                        helperText={pathProblem ? pathProblem.message : null}
                        onChange={e =>
                          // Multiline only to show long paths whole; a path
                          // is one line.
                          change(shortcut.id, {
                            path: e.target.value.replace(/[\r\n]+/g, '')
                          })
                        }
                        slotProps={{
                          formHelperText: { id: `${shortcut.id}-path-problem` },
                          htmlInput: {
                            'aria-label': `Page opened by ${label}`,
                            'data-field': `${shortcut.id}-path`,
                            spellCheck: false,
                            title: shortcut.path,
                            style: {
                              fontFamily: 'var(--ad-font-mono)',
                              fontSize: 13
                            }
                          }
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {shortcut.action ? null : (
                      <IconAction
                        label={`Remove shortcut ${shortcut.name || shortcut.path || ''}`.trim()}
                        icon={<DeleteIcon />}
                        onClick={() => remove(shortcut)}
                        data-field={`${shortcut.id}-remove`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>

      <Box
        sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={add}
          data-field="add"
        >
          Add shortcut
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="body2"
          color="text.secondary"
          role="status"
          sx={{ mr: 1 }}
        >
          {dirty ? 'Unsaved changes' : ''}
        </Typography>
        <Button variant="text" onClick={() => setConfirmRestore(true)}>
          Restore defaults…
        </Button>
        <Button variant="contained" onClick={onSave} disabled={!dirty}>
          Save shortcuts
        </Button>
      </Box>
      <Box role="status" aria-live="polite">
        {status ? (
          <Alert
            severity={status.severity}
            action={
              status.undo ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => undo(status.undo)}
                >
                  Undo
                </Button>
              ) : null
            }
          >
            {status.message}
          </Alert>
        ) : null}
      </Box>

      <Box component="section" aria-labelledby="fixed-shortcuts-title">
        <Typography
          id="fixed-shortcuts-title"
          component="h3"
          variant="h3"
          sx={{ mb: 1 }}
        >
          Other shortcuts
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Fixed keys of the classic debug log pages (they follow the switch
          above) and of the log viewer.
        </Typography>
        <ShortcutList
          title="Classic debug log page"
          headingLevel={4}
          items={CLASSIC_LOG_PAGE_SHORTCUTS.map(s => ({
            ...s,
            keys: [s.keys]
          }))}
        />
        <ShortcutList
          title="Classic debug log list"
          headingLevel={4}
          items={CLASSIC_LOG_LIST_SHORTCUTS.map(s => ({
            ...s,
            keys: [s.keys]
          }))}
        />
        <ShortcutList
          title="Log viewer (Apex Debugger)"
          headingLevel={4}
          items={APP_SHORTCUTS}
        />
      </Box>

      <Dialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        aria-labelledby="restore-title"
        aria-describedby="restore-description"
        maxWidth="xs"
      >
        <DialogTitle id="restore-title">
          Restore the default shortcuts?
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            id="restore-description"
            sx={{ color: 'text.primary' }}
          >
            Your own shortcuts and changed keys are replaced by the defaults,
            and page shortcuts are turned on. You can undo this right after.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmRestore(false)} autoFocus>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={restoreDefaults}>
            Restore defaults
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  )
}

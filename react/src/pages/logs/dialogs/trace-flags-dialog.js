import { useEffect, useId, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemText,
  MenuItem,
  TextField,
  Typography
} from '@mui/material'
import {
  findTraceTargets,
  loadTraceSetup,
  startTrace,
  stopTrace
} from '../actions'
import { explainError } from '../../../core/salesforce/errors'
import {
  CUSTOM_DEBUG_LEVEL_NAME,
  DEBUG_LEVEL_NAME
} from '../../../core/salesforce/client'
import {
  CATEGORY_LABELS,
  DEBUG_LEVEL_CATEGORIES,
  describeLevels,
  formatRemaining,
  LEVEL_PRESETS,
  LOG_LEVELS,
  LOG_TYPE_LABELS,
  TRACE_DURATIONS
} from '../../../core/salesforce/trace-flags'
import { formatClock } from '../utils'

const TARGETS = [
  { value: 'me', label: 'Me' },
  { value: 'user', label: 'Another user' },
  { value: 'automated', label: 'Automated Process' },
  { value: 'code', label: 'An Apex class or trigger' }
]

const TARGET_NOTES = {
  me: 'Logs your actions in this org.',
  user: 'Logs what this user does, for example an integration or a Site guest user.',
  automated:
    'Logs work that runs as Automated Process: platform event triggers and some asynchronous Apex and flows.',
  code: 'Sets the log levels inside this class or trigger. Logs are still only written for traced users.'
}

const KIND_LABELS = { user: 'User', class: 'Class', trigger: 'Trigger' }

// Default duration of a new trace flag: 1 hour (the header's "Start
// logging" keeps Salesforce's maximum of 24 hours).
const DEFAULT_DURATION = TRACE_DURATIONS[1].ms

// "Trace flags…": the org's active trace flags with their expiry and a Stop
// button each, and a form to trace me, another user, Automated Process or an
// Apex class or trigger with a debug level (the extension's, one of the
// org's, or custom levels per category) for a chosen duration. Nothing is
// traced until "Start tracing" is pressed.
export default function TraceFlagsDialog({ open, onClose, host }) {
  const dispatch = useDispatch()
  const id = useId()
  const [setup, setSetup] = useState({ status: 'loading' })
  const [target, setTarget] = useState('me')
  const [picked, setPicked] = useState(null)
  const [level, setLevel] = useState('default')
  const [custom, setCustom] = useState(LEVEL_PRESETS[0].levels)
  const [durationMs, setDurationMs] = useState(DEFAULT_DURATION)
  const [running, setRunning] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    let current = true
    setSetup({ status: 'loading' })
    setTarget('me')
    setPicked(null)
    setLevel('default')
    setCustom(LEVEL_PRESETS[0].levels)
    setDurationMs(DEFAULT_DURATION)
    setRunning(null)
    setError(null)
    dispatch(loadTraceSetup()).then(
      result => current && setSetup({ status: 'ready', ...result }),
      err =>
        current && setSetup({ status: 'error', error: explainError(err, host) })
    )
    return () => {
      current = false
    }
  }, [open, dispatch, host])

  const needsPick = target === 'user' || target === 'code'
  const busy = running !== null
  const orgLevels =
    setup.status === 'ready'
      ? setup.debugLevels.filter(
          l => l.name !== DEBUG_LEVEL_NAME && l.name !== CUSTOM_DEBUG_LEVEL_NAME
        )
      : []
  const chosenLevel = orgLevels.find(l => `level:${l.id}` === level)

  const levelChoice = () => {
    if (level === 'custom') return { kind: 'custom', levels: custom }
    if (chosenLevel) return { kind: 'existing', id: chosenLevel.id }
    return { kind: 'default' }
  }
  const targetChoice = () => {
    if (target === 'user' || target === 'code')
      return { kind: target, id: picked.id, name: picked.name }
    return { kind: target }
  }

  const withFlags = async (key, action) => {
    setError(null)
    setRunning(key)
    try {
      const flags = await dispatch(action)
      setSetup(s => (s.status === 'ready' ? { ...s, flags } : s))
      return true
    } catch (err) {
      setError(explainError(err, host))
      return false
    } finally {
      setRunning(null)
    }
  }

  const start = () =>
    withFlags(
      'start',
      startTrace({
        target: targetChoice(),
        level: levelChoice(),
        durationMs
      })
    )

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby={`${id}-title`}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id={`${id}-title`}>Trace flags</DialogTitle>
      <DialogContent>
        <Typography
          component="h3"
          variant="subtitle1"
          id={`${id}-active`}
          sx={{ mb: 1 }}
        >
          Active trace flags
        </Typography>
        {setup.status === 'loading' ? (
          <Box
            role="status"
            sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}
          >
            <CircularProgress size={16} aria-hidden />
            <Typography variant="body2">Loading trace flags…</Typography>
          </Box>
        ) : null}
        {setup.status === 'error' ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Couldn’t read the trace flags. {setup.error.title}{' '}
            {setup.error.hint}
          </Alert>
        ) : null}
        {setup.status === 'ready' ? (
          <ActiveFlags
            labelledBy={`${id}-active`}
            flags={setup.flags}
            userId={setup.userId}
            stopping={running}
            disabled={busy}
            onStop={flag => withFlags(flag.id, stopTrace(flag))}
          />
        ) : null}

        <Divider sx={{ my: 2 }} />
        <Typography component="h3" variant="subtitle1" sx={{ mb: 1.5 }}>
          Start tracing
        </Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            select
            id={`${id}-target`}
            label="Trace"
            value={target}
            disabled={busy}
            onChange={e => {
              setTarget(e.target.value)
              setPicked(null)
            }}
            helperText={TARGET_NOTES[target]}
          >
            {TARGETS.map(t => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          {needsPick ? (
            <TargetSearch
              key={target}
              kind={target}
              value={picked}
              onChange={setPicked}
              disabled={busy}
              host={host}
            />
          ) : null}
          <TextField
            select
            id={`${id}-level`}
            label="Debug level"
            value={chosenLevel || level === 'custom' ? level : 'default'}
            disabled={busy}
            onChange={e => setLevel(e.target.value)}
            helperText={
              level === 'custom'
                ? `Saved as ${CUSTOM_DEBUG_LEVEL_NAME} in the org.`
                : chosenLevel
                  ? describeLevels(chosenLevel.levels)
                  : 'DEBUG for every category.'
            }
          >
            <MenuItem value="default">
              {DEBUG_LEVEL_NAME} (extension default)
            </MenuItem>
            {orgLevels.map(l => (
              <MenuItem key={l.id} value={`level:${l.id}`}>
                {l.name}
              </MenuItem>
            ))}
            <MenuItem value="custom">Custom levels…</MenuItem>
          </TextField>
          {level === 'custom' ? (
            <CustomLevels
              id={id}
              levels={custom}
              onChange={setCustom}
              disabled={busy}
            />
          ) : null}
          <TextField
            select
            id={`${id}-duration`}
            label="Duration"
            value={durationMs}
            disabled={busy}
            onChange={e => setDurationMs(Number(e.target.value))}
            helperText="Salesforce allows at most 24 hours."
          >
            {TRACE_DURATIONS.map(d => (
              <MenuItem key={d.ms} value={d.ms}>
                {d.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {running === 'start' ? (
          <Box sx={{ mt: 2 }} role="status">
            <Typography variant="body2">Starting the trace flag…</Typography>
          </Box>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }} role="alert">
            {error.title} {error.hint}
            <Box component="details" sx={{ mt: 0.5, fontSize: 12 }}>
              <summary>Details</summary>
              {error.detail}
            </Box>
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={start}
          disabled={
            busy || setup.status === 'loading' || (needsPick && !picked)
          }
        >
          Start tracing
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ActiveFlags({
  labelledBy,
  flags,
  userId,
  stopping,
  disabled,
  onStop
}) {
  if (!flags.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No active trace flags in this org.
      </Typography>
    )
  }
  return (
    <Box
      component="ul"
      aria-labelledby={labelledBy}
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}
    >
      {flags.map(flag => {
        const name =
          flag.entityId === userId
            ? `You${flag.entityName ? ` (${flag.entityName})` : ''}`
            : flag.entityName || flag.entityId
        const kind = KIND_LABELS[flag.entityKind] || 'Entity'
        const details = [
          flag.logType === 'USER_DEBUG'
            ? null
            : LOG_TYPE_LABELS[flag.logType] || flag.logType,
          `Debug level ${flag.debugLevel || 'unknown'}`,
          `until ${formatClock(flag.expiresAt)} (${formatRemaining(flag.expiresAt)})`
        ].filter(Boolean)
        return (
          <Box
            component="li"
            key={flag.id}
            data-flag-id={flag.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 0.5,
              borderBottom: 1,
              borderColor: 'divider'
            }}
          >
            <ListItemText
              primary={`${name} · ${kind}`}
              secondary={details.join(' · ')}
              sx={{ my: 0 }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => onStop(flag)}
              disabled={disabled}
              aria-label={`Stop tracing ${name}`}
              startIcon={
                stopping === flag.id ? (
                  <CircularProgress size={14} aria-hidden />
                ) : null
              }
            >
              Stop
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

// A user or an Apex class or trigger, found by name as the user types.
function TargetSearch({ kind, value, onChange, disabled, host }) {
  const dispatch = useDispatch()
  const [input, setInput] = useState('')
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const term = input.trim()

  useEffect(() => {
    if (term.length < 2) {
      setOptions([])
      setLoading(false)
      return
    }
    let current = true
    setLoading(true)
    const timer = setTimeout(() => {
      dispatch(findTraceTargets(kind, term)).then(
        found => {
          if (!current) return
          setOptions(found)
          setError(null)
          setLoading(false)
        },
        err => {
          if (!current) return
          setError(explainError(err, host))
          setLoading(false)
        }
      )
    }, 300)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [term, kind, dispatch, host])

  const label = kind === 'user' ? 'User' : 'Apex class or trigger'
  return (
    <Autocomplete
      value={value}
      onChange={(e, option) => onChange(option)}
      inputValue={input}
      onInputChange={(e, text) => setInput(text)}
      options={
        value && !options.some(o => o.id === value.id)
          ? [value, ...options]
          : options
      }
      loading={loading}
      disabled={disabled}
      filterOptions={x => x}
      getOptionLabel={option => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={
        term.length < 2 ? 'Type at least 2 characters' : 'No matches'
      }
      loadingText="Searching…"
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <ListItemText primary={option.name} secondary={option.detail} />
          </li>
        )
      }}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          placeholder={
            kind === 'user' ? 'Name or username' : 'Class or trigger name'
          }
          error={Boolean(error)}
          helperText={error ? `${error.title} ${error.hint}` : null}
        />
      )}
    />
  )
}

// A level per category, with presets to start from.
function CustomLevels({ id, levels, onChange, disabled }) {
  return (
    <Box>
      <Box
        role="group"
        aria-label="Presets"
        sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}
      >
        {LEVEL_PRESETS.map(preset => (
          <Button
            key={preset.id}
            size="small"
            variant="outlined"
            disabled={disabled}
            onClick={() => onChange(preset.levels)}
          >
            {preset.label}
          </Button>
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 1.5
        }}
      >
        {DEBUG_LEVEL_CATEGORIES.map(category => (
          <TextField
            key={category}
            select
            size="small"
            id={`${id}-cat-${category}`}
            label={CATEGORY_LABELS[category]}
            value={levels[category]}
            disabled={disabled}
            onChange={e => onChange({ ...levels, [category]: e.target.value })}
          >
            {LOG_LEVELS.map(l => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Box>
    </Box>
  )
}

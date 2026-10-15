import { useEffect, useId, useRef, useState } from 'react'
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
// traced until "Start tracing" is pressed. `preset` (an id of LEVEL_PRESETS)
// opens it with those custom levels chosen.
export default function TraceFlagsDialog({
  open,
  onClose,
  host,
  preset = null,
  disableRestoreFocus = false
}) {
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
  const [pickMissing, setPickMissing] = useState(false)
  const [loads, setLoads] = useState(0)
  const now = useNow(open)
  const pickRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const chosen = preset && LEVEL_PRESETS.find(p => p.id === preset)
    setTarget('me')
    setPicked(null)
    setLevel(chosen ? 'custom' : 'default')
    setCustom((chosen || LEVEL_PRESETS[0]).levels)
    setDurationMs(DEFAULT_DURATION)
    setRunning(null)
    setError(null)
    setPickMissing(false)
  }, [open, preset])

  useEffect(() => {
    if (!open) return
    let current = true
    setSetup({ status: 'loading' })
    dispatch(loadTraceSetup()).then(
      result => current && setSetup({ status: 'ready', ...result }),
      err =>
        current && setSetup({ status: 'error', error: explainError(err, host) })
    )
    return () => {
      current = false
    }
  }, [open, loads, dispatch, host])

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

  // Runs a start or stop and shows the active flags it resolves with; on
  // failure, says what failed (`failed`) and why.
  const withFlags = async (key, action, failed) => {
    setError(null)
    setRunning(key)
    try {
      const flags = await dispatch(action)
      setSetup(s => (s.status === 'ready' ? { ...s, flags } : s))
      return true
    } catch (err) {
      setError({ ...explainError(err, host), failed })
      return false
    } finally {
      setRunning(null)
    }
  }

  // A user, class or trigger must be picked first: says so at the field
  // (rather than a Start button disabled without a reason).
  const start = () => {
    if (needsPick && !picked) {
      setPickMissing(true)
      pickRef.current?.focus()
      return
    }
    return withFlags(
      'start',
      startTrace({
        target: targetChoice(),
        level: levelChoice(),
        durationMs
      }),
      'Couldn’t start tracing.'
    )
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      disableRestoreFocus={disableRestoreFocus}
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
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setLoads(n => n + 1)}
              >
                Retry
              </Button>
            }
          >
            Couldn’t read the trace flags. {setup.error.title}{' '}
            {setup.error.hint}
            {setup.error.detail ? (
              <Box component="details" sx={{ mt: 0.5, fontSize: 12 }}>
                <summary>Details</summary>
                {setup.error.detail}
              </Box>
            ) : null}
          </Alert>
        ) : null}
        {setup.status === 'ready' ? (
          <ActiveFlags
            labelledBy={`${id}-active`}
            flags={setup.flags}
            userId={setup.userId}
            now={now}
            stopping={running}
            disabled={busy}
            onStop={(flag, name) =>
              withFlags(
                flag.id,
                stopTrace(flag),
                `Couldn’t stop tracing ${name}.`
              )
            }
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
              setPickMissing(false)
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
              onChange={option => {
                setPicked(option)
                if (option) setPickMissing(false)
              }}
              missing={pickMissing}
              inputRef={pickRef}
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
            {error.failed} {error.title} {error.hint}
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
          disabled={busy || setup.status === 'loading'}
        >
          Start tracing
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// The current time, renewed every 30 seconds while `active`, so the time
// left on each flag stays true while the dialog is open.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function ActiveFlags({
  labelledBy,
  flags,
  userId,
  now,
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
        // The log type only when the kind doesn't say it (Developer Console).
        const details = [
          flag.logType === 'USER_DEBUG' || flag.logType === 'CLASS_TRACING'
            ? null
            : LOG_TYPE_LABELS[flag.logType] || flag.logType,
          `Debug level ${flag.debugLevel || 'unknown'}`
        ].filter(Boolean)
        const remaining = formatRemaining(flag.expiresAt, now)
        const until = formatClock(flag.expiresAt, new Date(now))
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
              sx={{ my: 0, minWidth: 0 }}
            />
            {remaining ? (
              <Box
                component="time"
                dateTime={flag.expiresAt}
                sx={{ textAlign: 'right', flexShrink: 0, lineHeight: 1.3 }}
              >
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    display: 'block',
                    color: 'text.primary',
                    fontWeight: 500
                  }}
                >
                  {remaining === 'ended' ? 'Ended' : remaining}
                </Typography>
                {until ? (
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ display: 'block', color: 'text.secondary' }}
                  >
                    until {until}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            <Button
              size="small"
              variant="outlined"
              sx={{ flexShrink: 0 }}
              onClick={() => onStop(flag, name)}
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
function TargetSearch({
  kind,
  value,
  onChange,
  missing,
  inputRef,
  disabled,
  host
}) {
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
          setOptions([])
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
  const searchError =
    error && term.length >= 2
      ? `Search failed. ${error.title} ${error.hint}`
      : null
  const helperText =
    searchError ||
    (missing
      ? `Choose ${kind === 'user' ? 'a user' : 'a class or trigger'} to trace.`
      : value
        ? value.detail
        : 'Type at least 2 characters to search.')
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
      // Inside the dialog, so the suggestions belong to it (screen readers
      // and the dialog's focus trap).
      disablePortal
      filterOptions={x => x}
      getOptionLabel={option => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={
        searchError ||
        (term.length < 2 ? 'Type at least 2 characters' : 'No matches')
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
          inputRef={inputRef}
          label={label}
          required
          placeholder={
            kind === 'user' ? 'Name or username' : 'Class or trigger name'
          }
          error={Boolean(searchError) || missing}
          helperText={helperText}
        />
      )}
    />
  )
}

// A level per category, with presets to start from.
function CustomLevels({ id, levels, onChange, disabled }) {
  return (
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Typography
        component="legend"
        variant="body2"
        sx={{ fontWeight: 500, mb: 1, p: 0 }}
      >
        Log level per category
      </Typography>
      <Box
        role="group"
        aria-labelledby={`${id}-presets-label`}
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 2
        }}
      >
        <Typography
          component="span"
          variant="body2"
          id={`${id}-presets-label`}
          sx={{ color: 'text.secondary' }}
        >
          Start from
        </Typography>
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

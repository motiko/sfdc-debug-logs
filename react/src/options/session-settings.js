import { useEffect, useState } from 'react'
import { Alert, Box, Button, Link, TextField, Typography } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import IconAction from '../ui/components/icon-action'
import Section from './section'

const HOW_TO =
  'https://dev.to/bowmanjd/3-ways-to-obtain-salesforce-session-id-visualforce-anonymous-apex-and-cookie-retrieval-h0m'

// Session (advanced): the session id saved for orgs whose session cookie the
// extension can't read (chrome.storage.local `token`, the service worker's
// fallback in getSessionForUrl). Explains when it's needed and what storing it
// means; saving and removing confirm in a status line.
export default function SessionSettings() {
  const [saved, setSaved] = useState(null)
  const [value, setValue] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    chrome.storage.local.get('token').then(({ token }) => {
      setSaved(token || '')
      setValue(token || '')
    })
  }, [])

  const store = async token => {
    try {
      if (token) await chrome.storage.local.set({ token })
      else await chrome.storage.local.remove('token')
      setSaved(token)
      setValue(token)
      setStatus({
        severity: 'success',
        message: token ? 'Session id saved.' : 'Saved session id removed.'
      })
    } catch (err) {
      setStatus({ severity: 'error', message: `Couldn’t save: ${err.message}` })
    }
  }

  return (
    <Section
      id="session"
      title="Session (advanced)"
      intro="Usually not needed: Apex Debugger uses the session of the Salesforce tab you’re logged in to."
    >
      <Typography variant="body2">
        Save a session id here only if Apex Debugger can’t find your session,
        for example when it says “Your Salesforce session has expired” although
        you’re logged in. It’s used only when the org’s session cookie can’t be
        read, and only sent to your Salesforce org (never to public Sites or
        other hosts).{' '}
        <Link href={HOW_TO} target="_blank" rel="noreferrer">
          How to find a session id
        </Link>
      </Typography>
      <Alert severity="warning" variant="outlined">
        The session id is stored unencrypted in this browser profile. Anyone
        with access to the profile can use it to act as you in the org until the
        session ends. Remove it when you don’t need it.
      </Alert>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}
      >
        <TextField
          id="session-id"
          label="Session id"
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={saved === null}
          onChange={e => {
            setStatus(null)
            setValue(e.target.value.trim())
          }}
          sx={{ flex: '1 1 320px' }}
          slotProps={{
            htmlInput: {
              autoComplete: 'off',
              spellCheck: false,
              style: { fontFamily: 'var(--ad-font-mono)' }
            }
          }}
        />
        <IconAction
          label={visible ? 'Hide session id' : 'Show session id'}
          icon={visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          onClick={() => setVisible(v => !v)}
          aria-pressed={visible}
          sx={{ mt: 0.25 }}
        />
        <Button
          variant="contained"
          disabled={!value || value === saved}
          onClick={() => store(value)}
        >
          Save session id
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={!saved}
          onClick={() => store('')}
        >
          Remove
        </Button>
      </Box>
      <Box role="status" aria-live="polite">
        {status ? (
          <Alert severity={status.severity}>{status.message}</Alert>
        ) : null}
      </Box>
    </Section>
  )
}

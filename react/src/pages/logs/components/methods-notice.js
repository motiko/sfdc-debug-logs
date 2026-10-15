import { useRef, useState } from 'react'
import { Alert, Button } from '@mui/material'
import TraceFlagsDialog from '../dialogs/trace-flags-dialog'
import { METHODS_PRESET_ID } from '../../../core/salesforce/trace-flags'

// Above the call tree and the timeline of a log written below Apex Code
// FINE, where Salesforce leaves out method calls: says so, and "Log
// methods…" opens the Trace flags dialog with the "Apex FINEST" levels
// chosen, so the next logs have them.
export default function MethodsNotice({ level, host }) {
  const [open, setOpen] = useState(false)
  const button = useRef(null)
  const close = () => {
    setOpen(false)
    setTimeout(() => button.current?.focus())
  }
  return (
    <>
      <Alert
        severity="info"
        data-testid="methods-notice"
        sx={{ borderRadius: 0, py: 0.25, alignItems: 'center' }}
        action={
          <Button
            ref={button}
            size="small"
            color="inherit"
            onClick={() => setOpen(true)}
          >
            Log methods…
          </Button>
        }
      >
        No method calls in this log: its Apex Code level is {level}. Salesforce
        logs methods from FINE up.
      </Alert>
      <TraceFlagsDialog
        open={open}
        onClose={close}
        host={host}
        preset={METHODS_PRESET_ID}
        disableRestoreFocus
      />
    </>
  )
}

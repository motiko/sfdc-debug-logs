import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button } from '@mui/material'
import CheckBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckIcon from '@mui/icons-material/CheckBox'
import { startLogging, checkIsLoggingAndStart } from '../actions'

// Whether the current user's actions are logged (a trace flag exists); starts
// logging when the app opens.
export default function TrackingLogs() {
  const dispatch = useDispatch()
  const isLogging = useSelector(state => state.logsPage.isLogging)

  useEffect(() => {
    dispatch(checkIsLoggingAndStart())
  }, [dispatch])

  if (isLogging) {
    return (
      <Button color="inherit" disabled startIcon={<CheckIcon />}>
        Logging Activity
      </Button>
    )
  }
  return (
    <Button
      color="inherit"
      startIcon={<CheckBlankIcon />}
      onClick={() => dispatch(startLogging())}
    >
      Start Logging
    </Button>
  )
}

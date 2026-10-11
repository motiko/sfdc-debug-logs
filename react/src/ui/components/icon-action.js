import { forwardRef } from 'react'
import { IconButton, Tooltip } from '@mui/material'

// An icon button with the same accessible name as its tooltip, and its
// keyboard shortcut in the tooltip ("Refresh (R)") and aria-keyshortcuts.
// Every icon-only control in the app goes through this.
const IconAction = forwardRef(function IconAction(
  { label, shortcut, icon, tooltipPlacement = 'bottom', ...props },
  ref
) {
  const title = shortcut ? `${label} (${shortcut})` : label
  const button = (
    <IconButton
      ref={ref}
      aria-label={label}
      aria-keyshortcuts={shortcut || undefined}
      {...props}
    >
      {icon}
    </IconButton>
  )
  // A disabled button gets no pointer events, so the tooltip needs a wrapper.
  return (
    <Tooltip title={title} placement={tooltipPlacement} describeChild>
      {props.disabled ? <span>{button}</span> : button}
    </Tooltip>
  )
})

export default IconAction

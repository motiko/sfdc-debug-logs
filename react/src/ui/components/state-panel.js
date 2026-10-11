import { Box, Typography } from '@mui/material'

// An empty or error state in the area it belongs to: an icon, a title that
// says what happened, a hint that says what to do, actions, and optional
// technical details (collapsed).
export default function StatePanel({
  icon,
  title,
  children,
  actions,
  details,
  tone = 'neutral',
  role,
  ...props
}) {
  return (
    <Box
      role={role}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        px: 3,
        py: 6,
        maxWidth: 560,
        mx: 'auto',
        color: 'text.primary'
      }}
      {...props}
    >
      {icon ? (
        <Box
          aria-hidden
          sx={{
            color: tone === 'error' ? 'error.main' : 'text.secondary',
            display: 'flex',
            '& svg': { fontSize: 40 }
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Typography component="h2" variant="h2">
        {title}
      </Typography>
      {children ? (
        <Typography variant="body2" color="text.secondary" component="div">
          {children}
        </Typography>
      ) : null}
      {actions ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'center',
            mt: 1
          }}
        >
          {actions}
        </Box>
      ) : null}
      {details ? (
        <Box
          component="details"
          sx={{
            mt: 1,
            color: 'text.secondary',
            fontSize: 12,
            '& summary': { cursor: 'pointer' }
          }}
        >
          <summary>Details</summary>
          <Box
            component="code"
            sx={{
              display: 'block',
              mt: 1,
              wordBreak: 'break-word',
              fontFamily: 'var(--ad-font-mono)'
            }}
          >
            {details}
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

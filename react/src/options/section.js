import { Box, Paper, Typography } from '@mui/material'

// One settings section: a heading, an intro and its controls, as a labeled
// region.
export default function Section({ id, title, intro, children }) {
  return (
    <Paper
      component="section"
      aria-labelledby={`${id}-title`}
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Box>
        <Typography id={`${id}-title`} component="h2" variant="h2">
          {title}
        </Typography>
        {intro ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {intro}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Paper>
  )
}

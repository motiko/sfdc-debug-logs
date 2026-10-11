import { Box, Typography } from '@mui/material'
import Keys from './kbd'
import { keyLabel } from '../../core/app-shortcuts'

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

// A titled list of shortcuts: items are { id, keys: string[], description }
// (keys in app-shortcuts.ts notation: "Shift+w", "Mod+s", "?"). Used by the
// app's "?" overlay and the options page.
export default function ShortcutList({ title, items, headingLevel = 3 }) {
  return (
    <Box component="section" sx={{ mb: 2 }}>
      <Typography component={`h${headingLevel}`} variant="h3" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None.
        </Typography>
      ) : (
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 220px) 1fr',
            gap: '6px 16px',
            m: 0
          }}
        >
          {items.map(item => (
            <Box key={item.id} sx={{ display: 'contents' }}>
              <Box
                component="dt"
                sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
              >
                {uniqueKeys(item.keys).map((k, i) => (
                  <span key={k}>
                    {i > 0 ? <span style={{ marginRight: 6 }}>or</span> : null}
                    <Keys keys={k} />
                  </span>
                ))}
              </Box>
              <Box component="dd" sx={{ m: 0, fontSize: 13 }}>
                {item.description}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

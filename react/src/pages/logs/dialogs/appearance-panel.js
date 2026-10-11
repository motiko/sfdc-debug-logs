import { Box, Drawer, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import IconAction from '../../../ui/components/icon-action'
import AppearanceSettings from '../../settings/appearance-settings'

// Appearance (from the "More actions" menu): a side panel, so the log stays
// visible while adjusting it. The settings themselves are shared with the
// options page (pages/settings/appearance-settings.js).
export default function AppearancePanel({ open, onClose, colorMode }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { invisible: true },
        paper: {
          role: 'dialog',
          'aria-labelledby': 'appearance-title',
          sx: {
            width: 400,
            maxWidth: '100vw',
            borderLeft: 1,
            borderColor: 'divider'
          }
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography
          id="appearance-title"
          component="h2"
          variant="h2"
          sx={{ flex: 1 }}
        >
          Appearance
        </Typography>
        <IconAction
          label="Close appearance"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </Box>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto'
        }}
      >
        <AppearanceSettings colorMode={colorMode} />
      </Box>
    </Drawer>
  )
}

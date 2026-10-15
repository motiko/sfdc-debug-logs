import { useState } from 'react'
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import HelpIcon from '@mui/icons-material/HelpOutlined'
import MoreIcon from '@mui/icons-material/MoreVert'
import PaletteIcon from '@mui/icons-material/PaletteOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import CloudIcon from '@mui/icons-material/CloudOutlined'
import IconAction from '../../../ui/components/icon-action'
import LoggingControl from './logging-control'
import { shortcutHint } from '../../../core/app-shortcuts'
import { layout } from '../../../ui/tokens'

// The app shell's header: name and org, the logging status, Refresh, help,
// and an overflow menu for the less common actions (appearance, Salesforce
// pages, settings, and "Delete logs…" in its own danger section).
export default function AppHeader({
  host,
  onRefresh,
  refreshing,
  onHelp,
  onAppearance,
  onDelete
}) {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const closeMenu = () => setMenuAnchor(null)
  const run = action => () => {
    closeMenu()
    action()
  }
  const orgUrl = path => `https://${host}${path}`
  return (
    <Box
      component="header"
      sx={{
        minHeight: layout.headerHeight,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
        px: 2,
        py: 0.5,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
          flex: '1 1 auto'
        }}
      >
        <Box
          component="img"
          src="../img/48.png"
          alt=""
          sx={{ width: 22, height: 22 }}
        />
        <Typography component="h1" variant="h1" sx={{ whiteSpace: 'nowrap' }}>
          Apex Debugger
        </Typography>
        <Tooltip title={`Logs of ${host}`}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
              color: 'text.secondary',
              fontSize: 13,
              ml: 1
            }}
          >
            <CloudIcon fontSize="small" aria-hidden />
            <Box component="span" className="sr-only">
              Org:
            </Box>
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              data-testid="org-host"
            >
              {host}
            </Box>
          </Box>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <LoggingControl host={host} />
        <IconAction
          label="Refresh logs"
          shortcut={shortcutHint('refresh')}
          icon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={refreshing}
        />
        <IconAction
          label="Keyboard shortcuts and help"
          shortcut="?"
          icon={<HelpIcon />}
          onClick={onHelp}
        />
        <IconAction
          label="More actions"
          icon={<MoreIcon />}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuAnchor)}
          aria-controls={menuAnchor ? 'more-actions-menu' : undefined}
          onClick={e => setMenuAnchor(e.currentTarget)}
        />
      </Box>
      <Menu
        id="more-actions-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-label': 'More actions', dense: true } }}
      >
        <MenuItem onClick={run(onAppearance)}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Appearance…</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href={orgUrl('/setup/ui/listApexTraces.apexp')}
          target="_blank"
          rel="noreferrer"
          onClick={closeMenu}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Debug logs in Salesforce</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href="options.html"
          target="_blank"
          rel="noreferrer"
          onClick={closeMenu}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Extension options</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={run(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete logs…</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}

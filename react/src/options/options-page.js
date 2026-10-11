import { useSelector } from 'react-redux'
import { Box, Container, Typography, Link } from '@mui/material'
import Section from './section'
import Themed from '../ui/themed'
import { useResolvedColorMode } from '../ui/color-mode'
import AppearanceSettings from '../pages/settings/appearance-settings'
import ShortcutsSettings from './shortcuts-settings'
import SessionSettings from './session-settings'

function Page() {
  const preference = useSelector(state => state.logsPage.colorMode)
  const mode = useResolvedColorMode(preference)
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary'
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Container
          maxWidth="md"
          sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}
        >
          <Box
            component="img"
            src="../img/48.png"
            alt=""
            sx={{ width: 32, height: 32 }}
          />
          <Box>
            <Typography component="h1" variant="h1" sx={{ fontSize: 20 }}>
              Apex Debugger settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Changes to Appearance apply at once, here and in open log viewer
              tabs.
            </Typography>
          </Box>
        </Container>
      </Box>
      <Container
        component="main"
        maxWidth="md"
        sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <Section
          id="appearance"
          title="Appearance"
          intro="How the log viewer and the classic debug log page look. Color mode applies to both; the classic page keeps its own palette and font size."
        >
          <Box
            sx={{
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <AppearanceSettings colorMode={mode} />
          </Box>
        </Section>
        <ShortcutsSettings />
        <SessionSettings />
        <Typography variant="body2" color="text.secondary" component="footer">
          Apex Debugger {chrome.runtime.getManifest().version} ·{' '}
          <Link
            href="https://github.com/motiko/sfdc-debug-logs"
            target="_blank"
            rel="noreferrer"
          >
            Source and issues on GitHub
          </Link>
        </Typography>
      </Container>
    </Box>
  )
}

export default function OptionsPage() {
  return (
    <Themed>
      <Page />
    </Themed>
  )
}

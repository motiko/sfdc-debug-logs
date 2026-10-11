import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Drawer,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import WarningIcon from '@mui/icons-material/WarningAmber'
import CheckIcon from '@mui/icons-material/Check'
import IconAction from '../../../ui/components/icon-action'
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  resetColors,
  restoreColors,
  setColorMode,
  setCustomColor,
  setFontSize,
  setTextWrap,
  setTheme
} from '../logs-slice'
import {
  AUTO_THEME,
  logThemes,
  paletteFor,
  themeCssVariables,
  withCustomColors
} from '../../../core/log/themes'
import { CATEGORY_LABELS, CATEGORY_SAMPLES } from '../../../core/log/categories'
import {
  CONTRAST,
  contrastRatio,
  formatRatio,
  parseHex
} from '../../../ui/contrast'
import { fontFamily } from '../../../ui/tokens'

// '#abc' -> '#aabbcc', what <input type="color"> needs; other values -> black.
function toHex6(color) {
  const rgb = parseHex(color)
  return rgb
    ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
    : '#000000'
}

const minimumFor = key =>
  key === 'error' || key === 'debug' ? CONTRAST.emphasis : CONTRAST.text

// Appearance (from the "More actions" menu): color mode, log palette, font
// size, wrapping and the user's own colors, with a live preview and a
// contrast check per color (docs/ux/baseline-review.md M3). A side panel, so
// the log stays visible while adjusting it.
export default function AppearancePanel({ open, onClose, colorMode }) {
  const dispatch = useDispatch()
  const preference = useSelector(state => state.logsPage.colorMode)
  const {
    theme: themeName,
    colors,
    fontSize,
    textWrap
  } = useSelector(state => state.logsPage.styleConfig)
  const [undo, setUndo] = useState(null)
  const theme = withCustomColors(paletteFor(themeName, colorMode), colors)
  const editable = [...Object.keys(CATEGORY_LABELS), 'background']

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
        <Box>
          <Typography
            id="color-mode-label"
            variant="subtitle2"
            component="h3"
            sx={{ mb: 0.5 }}
          >
            Color mode
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={preference}
            onChange={(e, value) => value && dispatch(setColorMode(value))}
            aria-labelledby="color-mode-label"
          >
            <ToggleButton value="system">System</ToggleButton>
            <ToggleButton value="light">Light</ToggleButton>
            <ToggleButton value="dark">Dark</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <TextField
          select
          id="log-colors"
          label="Log colors"
          value={themeName}
          onChange={e => dispatch(setTheme(e.target.value))}
          helperText="“Match app” uses the light or dark palette with the color mode."
        >
          <MenuItem value={AUTO_THEME}>Match app (Light or Dark)</MenuItem>
          {Object.values(logThemes).map(t => (
            <MenuItem key={t.name} value={t.name}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            id="font-size"
            label="Font size"
            type="number"
            value={fontSize}
            onChange={e => dispatch(setFontSize(Number(e.target.value)))}
            slotProps={{
              htmlInput: { min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, step: 1 }
            }}
            sx={{ width: 110 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={textWrap}
                onChange={e => dispatch(setTextWrap(e.target.checked))}
              />
            }
            label="Wrap long lines"
          />
        </Box>

        {/* Live preview, one line per category. */}
        <Box
          aria-label="Preview"
          role="img"
          style={themeCssVariables(theme)}
          sx={{
            fontFamily: fontFamily.mono,
            fontSize,
            lineHeight: 1.45,
            p: 1,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            backgroundColor: 'var(--log-background)',
            whiteSpace: textWrap ? 'pre-wrap' : 'pre',
            overflowX: 'auto'
          }}
        >
          {Object.keys(CATEGORY_LABELS).map(category => {
            const [event, ...rest] = CATEGORY_SAMPLES[category].split('|')
            return (
              <div
                key={category}
                style={{ color: `var(--log-${category}-color)` }}
              >
                <span style={{ color: 'var(--log-muted)' }}>
                  12:01:02.131 (93)|
                </span>
                <span style={{ fontWeight: 600 }}>{event}</span>
                <span
                  style={{
                    fontWeight: `var(--log-${category}-weight)`,
                    fontStyle: `var(--log-${category}-style)`
                  }}
                >
                  |{rest.join('|')}
                </span>
              </div>
            )
          })}
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ flex: 1 }}>
              Colors
            </Typography>
            <Button
              size="small"
              disabled={Object.keys(colors).length === 0}
              onClick={() => {
                setUndo(colors)
                dispatch(resetColors())
              }}
            >
              Reset to palette
            </Button>
          </Box>
          {undo ? (
            <Box
              role="status"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                fontSize: 13
              }}
            >
              Your colors were reset.
              <Button
                size="small"
                onClick={() => {
                  dispatch(restoreColors(undo))
                  setUndo(null)
                }}
              >
                Undo
              </Button>
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {editable.map(key => {
              const label =
                key === 'background' ? 'Background' : CATEGORY_LABELS[key]
              const value =
                key === 'background'
                  ? theme.background
                  : theme.categories[key].color
              const ratio =
                key === 'background'
                  ? Math.min(
                      ...Object.values(theme.categories).map(s =>
                        safeRatio(s.color, theme.background)
                      )
                    )
                  : safeRatio(value, theme.background)
              const minimum =
                key === 'background' ? CONTRAST.text : minimumFor(key)
              const ok = ratio >= minimum
              const set = color => {
                setUndo(null)
                dispatch(setCustomColor({ key, color }))
              }
              return (
                <Box
                  key={key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr auto',
                    gap: 1,
                    alignItems: 'center'
                  }}
                >
                  <Box
                    component="input"
                    type="color"
                    aria-label={`${label} color picker`}
                    value={toHex6(value)}
                    onChange={e => set(e.target.value)}
                    sx={{
                      width: 32,
                      height: 32,
                      p: 0,
                      border: 1,
                      borderColor: 'var(--ad-border)',
                      borderRadius: 1,
                      bgcolor: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <TextField
                    label={label}
                    value={value}
                    onChange={e => set(e.target.value)}
                    slotProps={{
                      htmlInput: {
                        spellCheck: false,
                        style: { fontFamily: fontFamily.mono }
                      }
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: 12,
                      minWidth: 84,
                      color: ok ? 'text.secondary' : 'warning.main'
                    }}
                    title={
                      key === 'background'
                        ? 'Lowest contrast of any log color on this background'
                        : `Contrast on the background (at least ${minimum}:1 recommended)`
                    }
                  >
                    {ok ? (
                      <CheckIcon
                        sx={{ fontSize: 16, color: 'success.main' }}
                        aria-hidden
                      />
                    ) : (
                      <WarningIcon sx={{ fontSize: 16 }} aria-hidden />
                    )}
                    {Number.isFinite(ratio) ? formatRatio(ratio) : '?'}
                    <span className="sr-only">
                      {ok ? 'contrast' : 'low contrast'}
                    </span>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>
    </Drawer>
  )
}

function safeRatio(a, b) {
  try {
    return contrastRatio(a, b)
  } catch {
    return NaN
  }
}

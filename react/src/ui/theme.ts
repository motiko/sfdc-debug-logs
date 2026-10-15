// The app's MUI themes, built from the design tokens (tokens.ts): one per
// color mode. Dense by default (developer tool), sentence-case buttons, a
// visible focus ring on every control, and the system UI font.
import { createTheme, type Theme } from '@mui/material/styles'
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  focusRing,
  radius,
  type ColorMode
} from './tokens'

const cache: Record<string, Theme> = {}

// No animated transitions (dialogs, menus, drawers) for users who ask the OS
// for reduced motion.
const NO_MOTION = {
  duration: {
    shortest: 0,
    shorter: 0,
    short: 0,
    standard: 0,
    complex: 0,
    enteringScreen: 0,
    leavingScreen: 0
  }
}

export function createAppTheme(mode: ColorMode, reducedMotion = false): Theme {
  const key = `${mode}${reducedMotion ? '-still' : ''}`
  if (cache[key]) return cache[key]
  const c = colors[mode]
  const ring = {
    outline: `${focusRing.width}px solid ${c.focus}`,
    outlineOffset: focusRing.offset
  }
  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: c.accent,
        dark: c.accentHover,
        contrastText: c.onAccent
      },
      error: {
        main: c.danger,
        dark: c.dangerHover,
        contrastText: c.onDanger
      },
      success: { main: c.success },
      warning: { main: c.warning },
      info: { main: c.focus },
      background: { default: c.bg, paper: c.surface },
      text: { primary: c.text, secondary: c.textMuted, disabled: c.textMuted },
      divider: c.divider,
      action: {
        hover: c.surfaceHover,
        selected: c.selected,
        // Disabled controls stay readable (text and borders, not 38% gray).
        disabled: c.textMuted,
        disabledBackground: c.surfaceHover
      }
    },
    shape: { borderRadius: radius.md },
    ...(reducedMotion ? { transitions: NO_MOTION } : {}),
    spacing: 8,
    typography: {
      fontFamily: fontFamily.ui,
      fontSize: fontSize.md,
      htmlFontSize: 16,
      h1: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        lineHeight: 1.3
      },
      h2: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        lineHeight: 1.3
      },
      h3: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        lineHeight: 1.4
      },
      subtitle1: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
      subtitle2: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
      body1: { fontSize: fontSize.md, lineHeight: 1.5 },
      body2: { fontSize: fontSize.sm, lineHeight: 1.45 },
      caption: { fontSize: fontSize.xs, lineHeight: 1.4 },
      button: {
        textTransform: 'none',
        fontWeight: fontWeight.medium,
        fontSize: fontSize.sm
      },
      overline: {
        fontSize: fontSize.xs,
        textTransform: 'none',
        fontWeight: fontWeight.semibold,
        letterSpacing: 0
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontSize: fontSize.md },
          ':focus-visible': ring,
          kbd: {
            fontFamily: fontFamily.mono,
            fontSize: fontSize.xs,
            padding: '1px 6px',
            borderRadius: radius.sm,
            border: `1px solid ${c.border}`,
            background: c.surfaceHover,
            color: c.text,
            whiteSpace: 'nowrap'
          }
        }
      },
      MuiButtonBase: {
        defaultProps: { disableRipple: true },
        styleOverrides: { root: { '&.Mui-focusVisible': ring } }
      },
      MuiButton: {
        defaultProps: { disableElevation: true, size: 'small' },
        styleOverrides: {
          root: { borderRadius: radius.md, minHeight: 32 },
          // MUI puts a zero-width space before icons, which Chrome adds to
          // the button's accessible name ("​ Filters").
          startIcon: { '&::before': { content: 'none' } },
          endIcon: { '&::before': { content: 'none' } }
        }
      },
      MuiIconButton: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { borderRadius: radius.md, color: c.text } }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            color: c.text,
            borderColor: c.border,
            padding: '4px 10px',
            '&.Mui-selected': {
              color: c.text,
              backgroundColor: c.selected,
              fontWeight: fontWeight.semibold
            }
          }
        }
      },
      MuiTooltip: {
        defaultProps: {
          arrow: false,
          enterDelay: 400,
          disableInteractive: true
        },
        styleOverrides: {
          tooltip: {
            fontSize: fontSize.xs,
            backgroundColor: mode === 'light' ? '#1b1f24' : '#e6edf3',
            color: mode === 'light' ? '#ffffff' : '#0d1117'
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          // Placeholders are hints, but must still be readable (4.5:1).
          input: { '&::placeholder': { color: c.textMuted, opacity: 1 } }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.border },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.focus,
              borderWidth: 2
            }
          },
          input: { paddingTop: 6, paddingBottom: 6 }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { color: c.textMuted, '&.Mui-focused': { color: c.text } }
        }
      },
      MuiFormHelperText: { styleOverrides: { root: { color: c.textMuted } } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiChip: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: { borderRadius: radius.md, fontWeight: fontWeight.medium },
          outlined: { borderColor: c.border },
          deleteIcon: { color: c.textMuted, '&:hover': { color: c.text } }
        }
      },
      // Menus and popovers size their animation to their height ('auto');
      // none at all with reduced motion.
      MuiPopover: {
        defaultProps: reducedMotion ? { transitionDuration: 0 } : {}
      },
      MuiMenu: { defaultProps: reducedMotion ? { transitionDuration: 0 } : {} },
      MuiMenuItem: {
        styleOverrides: { root: { fontSize: fontSize.sm, minHeight: 32 } }
      },
      MuiListSubheader: {
        styleOverrides: {
          root: {
            fontSize: fontSize.xs,
            lineHeight: '28px',
            color: c.textMuted,
            fontWeight: fontWeight.semibold
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold }
        }
      },
      MuiDialog: { defaultProps: { slotProps: { paper: { elevation: 8 } } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiSwitch: {
        styleOverrides: {
          // The unchecked track must be visible (>= 3:1) too.
          track: { backgroundColor: c.border, opacity: 1 },
          switchBase: { '&.Mui-checked + .MuiSwitch-track': { opacity: 1 } }
        }
      },
      MuiLinearProgress: { styleOverrides: { root: { height: 3 } } },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            fontSize: fontSize.sm,
            backgroundColor: c.text,
            color: c.surface
          }
        }
      },
      MuiLink: {
        defaultProps: { underline: 'always' },
        styleOverrides: { root: { color: c.accent } }
      },
      MuiCheckbox: { styleOverrides: { root: { color: c.border } } },
      MuiRadio: { styleOverrides: { root: { color: c.border } } }
    }
  })
  cache[key] = theme
  return theme
}

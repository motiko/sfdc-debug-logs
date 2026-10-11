import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField
} from '@mui/material'
import { toggleTextWrap, updateFontSize, updateTheme } from '../../logs-slice'
import { appTheme, logThemes } from '../../../../core/log/themes'
import ColorPickers from './color-pickers'

// Log body style: font size, wrapping, color theme and single colors.
export default function StyleDialog({ open, onClose }) {
  const dispatch = useDispatch()
  const { fontSize, theme, textWrap } = useSelector(
    state => state.logsPage.styleConfig
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="style-dialog-title"
      slotProps={{ paper: { sx: { height: '100%' } } }}
    >
      <DialogTitle id="style-dialog-title">Log View Style</DialogTitle>
      <DialogContent>
        <form>
          <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <TextField
              id="font-size"
              variant="standard"
              label="Font Size"
              value={fontSize}
              onChange={e => dispatch(updateFontSize(e.target.value))}
              sx={{ mx: 2, width: 200 }}
              type="number"
              margin="normal"
            />
            <FormControlLabel
              sx={{ mb: 1 }}
              control={
                <Switch
                  checked={textWrap}
                  onChange={() => dispatch(toggleTextWrap())}
                />
              }
              label="Text Wrap"
            />
          </Box>
          <TextField
            select
            variant="standard"
            label="Log Color Theme"
            sx={{ mx: 2, width: 200 }}
            value={theme.themeName}
            onChange={e => dispatch(updateTheme(appTheme(e.target.value)))}
            helperText="Please select log color theme"
            margin="normal"
          >
            {Object.values(logThemes).map(option => (
              <MenuItem key={option.name} value={option.name}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <ColorPickers theme={theme} />
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

import { useDispatch } from 'react-redux'
import { Box, InputAdornment, TextField } from '@mui/material'
import { updateColor } from '../../logs-slice'
import { logEventToType } from '../../../../core/log/categories'

// The event type prefixes of a category, as the color's helper text.
const typeToLogEvents = desiredType =>
  Object.entries(logEventToType)
    .filter(([, type]) => desiredType == type)
    .map(([event]) => event)

// '#abc' -> '#aabbcc'; what <input type="color"> needs. Other CSS colors
// (names, rgb()) show black in the swatch but still apply.
function toHex6(color) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)
  return short
    ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
    : '#000000'
}

const capitalize = name => name[0].toUpperCase() + name.substring(1)

// One color per category, plus the background: a text field for any CSS
// color and a swatch that opens the browser's color picker.
export default function ColorPickers({ theme }) {
  const dispatch = useDispatch()
  const setColor = (propName, newColor) =>
    dispatch(updateColor({ propName, newColor }))
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        columnGap: 2,
        mt: 3,
        ml: 1
      }}
    >
      {Object.keys(theme)
        .filter(key => key !== 'themeName')
        .map(propertyName => (
          <TextField
            key={propertyName}
            variant="standard"
            name="color"
            margin="normal"
            label={capitalize(propertyName)}
            value={theme[propertyName]}
            onChange={e => setColor(propertyName, e.target.value)}
            helperText={typeToLogEvents(propertyName).join(' ')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <input
                      type="color"
                      aria-label={`${capitalize(propertyName)} color picker`}
                      value={toHex6(theme[propertyName])}
                      onChange={e => setColor(propertyName, e.target.value)}
                      style={{
                        width: 24,
                        height: 24,
                        padding: 0,
                        border: 0,
                        background: 'none',
                        cursor: 'pointer'
                      }}
                    />
                  </InputAdornment>
                )
              }
            }}
          />
        ))}
    </Box>
  )
}

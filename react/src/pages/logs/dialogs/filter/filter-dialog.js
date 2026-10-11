import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Slider,
  TextField
} from '@mui/material'
import {
  clearFilters,
  defaultFilters,
  toggleFiltersDialog,
  updateFilter
} from '../../logs-slice'

const lengthFormatter = value => `${(value / 1000).toFixed(2)} k`
const durationFormatter = value => `${value} ms`

// Filters for the log list, applied when the logs are next loaded and to the
// loaded ones. possibleFieldValues: the values of the loaded logs.
export default function FilterDialog({ open, possibleFieldValues }) {
  const dispatch = useDispatch()
  const filters = useSelector(state => state.logsPage.filters)
  const close = () => dispatch(toggleFiltersDialog())
  const update = (filterName, newValue) =>
    dispatch(updateFilter({ filterName, newValue }))

  const filterByText = (fieldName, fieldLabel) => (
    <TextField
      select
      variant="standard"
      label={fieldLabel}
      value={filters[fieldName].value}
      onChange={e => update(fieldName, e.target.value)}
      sx={{ mx: 1, width: 200 }}
      helperText={`Only show logs when ${fieldLabel} is:`}
      margin="normal"
    >
      <MenuItem value="">All</MenuItem>
      {possibleFieldValues[fieldName].map(value => (
        <MenuItem key={value} value={value}>
          {value}
        </MenuItem>
      ))}
    </TextField>
  )

  const filterByNumber = (fieldName, fieldFormatter) => {
    const [min, max] = filters[fieldName].value
    const label = `Show logs where ${fieldName} is in`
    return (
      <Box sx={{ width: 400, m: '50px' }}>
        <p>
          {label} {fieldFormatter(min)} - {fieldFormatter(max)}
        </p>
        <Slider
          getAriaLabel={index =>
            `${index === 0 ? 'Minimum' : 'Maximum'} ${fieldName}`
          }
          min={defaultFilters[fieldName].value[0]}
          max={defaultFilters[fieldName].value[1]}
          value={filters[fieldName].value}
          valueLabelDisplay="auto"
          valueLabelFormat={fieldFormatter}
          getAriaValueText={fieldFormatter}
          onChange={(e, value) => update(fieldName, value)}
        />
      </Box>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      aria-labelledby="filters-dialog-title"
    >
      <DialogTitle id="filters-dialog-title">Filters</DialogTitle>
      <DialogContent>
        <DialogContentText>Pick Fields to filter by:</DialogContentText>
        <form>
          {filterByText('user', 'User')}
          {filterByText('operation', 'Operation')}
          {filterByText('status', 'Status')}
          {filterByNumber('length', lengthFormatter)}
          {filterByNumber('duration', durationFormatter)}
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => dispatch(clearFilters())}>Clear filters</Button>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

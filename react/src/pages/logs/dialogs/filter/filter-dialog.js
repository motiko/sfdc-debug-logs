import React from 'react'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from 'material-ui/Dialog'
import { FormControlLabel, FormControl, FormHelperText } from 'material-ui/Form'
import { connect } from 'react-redux'
import MenuItem from 'material-ui/Menu/MenuItem'
import { withStyles } from 'material-ui/styles'
import { toggleFiltersDialog, updateFilter, clearFilters } from './actions'
import Slider from 'rc-slider'
import Tooltip from 'rc-tooltip'
import 'rc-slider/assets/index.css'
import 'rc-tooltip/assets/bootstrap.css'

const createSliderWithTooltip = Slider.createSliderWithTooltip
const Range = createSliderWithTooltip(Slider.Range)

const maxRangeValues = {
  length: { min: 0, max: 2.5 * Math.pow(10, 6) },
  duration: { min: 0, max: 2 * 6 * Math.pow(10, 3) }
}

const mapStateToProps = state => {
  return state.logsPage.filters
}

const mapDispatchToProps = dispatch => ({
  toggleFiltersDialog: () => dispatch(toggleFiltersDialog()),
  updateTextFilter: fieldName => event =>
    dispatch(updateFilter(fieldName, event.target.value)),
  updateNumericFilter: fieldName => value =>
    dispatch(updateFilter(fieldName, value)),
  clearFilters: () => dispatch(clearFilters())
})

const styles = theme => ({
  textField: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: 200
  }
})

@withStyles(styles)
@connect(state => state.logsPage.filters, mapDispatchToProps)
export default class FilterDialog extends React.Component {
  render() {
    let props = this.props
    const filterByText = (fieldName, fieldLabel) => (
      <TextField
        select
        label={fieldLabel}
        value={props[fieldName].value}
        onChange={props.updateTextFilter(fieldName)}
        className={props.classes.textField}
        SelectProps={{
          MenuProps: {}
        }}
        helperText={`Only show logs when ${fieldLabel} is:`}
        margin="normal"
      >
        <MenuItem key="" value="">
          All
        </MenuItem>
        {props.possibleFieldValues[fieldName].map(value => (
          <MenuItem key={value} value={value}>
            {value}
          </MenuItem>
        ))}
      </TextField>
    )
    const filterByNumber = (fieldName, fieldFormatter) => (
      <div style={{ width: 400, margin: 50 }}>
        <p>
          Show logs where {fieldName} is in{' '}
          {fieldFormatter(props[fieldName].value[0])}
          {` - `}
          {fieldFormatter(props[fieldName].value[1])}
        </p>
        <Range
          min={maxRangeValues[fieldName].min}
          max={maxRangeValues[fieldName].max}
          value={props[fieldName].value}
          tipFormatter={fieldFormatter}
          onChange={props.updateNumericFilter(fieldName)}
        />
      </div>
    )
    const lengthFormatter = value => `${(value / 1000).toFixed(2)} k`
    const durationFormatter = value => `${value} ms`
    return (
      <Dialog
        open={props.open}
        onClose={props.toggleFiltersDialog}
        fullWidth
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-dialog-title">Filters</DialogTitle>
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
          <Button onClick={props.clearFilters} color="primary">
            Clear filters
          </Button>
          <Button onClick={props.toggleFiltersDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

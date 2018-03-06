import React from 'react'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from 'material-ui/Dialog'
import { FormControl, FormHelperText } from 'material-ui/Form'
import Select from 'material-ui/Select'
import Input, { InputLabel } from 'material-ui/Input'
import { connect } from 'react-redux'
import { toggleFiltersDialog } from './actions'
import MenuItem from 'material-ui/Menu/MenuItem'
import { withStyles } from 'material-ui/styles'

const mapStateToProps = state => {
  return state.logs.filtersDialog
}

const mapDispatchToProps = dispatch => ({
  toggleFiltersDialog: () => dispatch(toggleFiltersDialog())
})

const styles = theme => ({
  textField: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: 200
  }
})

class FilterDialogRaw extends React.Component {
  filterBy() {}
  render() {
    let props = this.props
    const filterBy = (fieldName, fieldLabel) => (
      <TextField
        id="select-field"
        select
        label={fieldLabel}
        value={props.user}
        onChange={() => {}}
        className={props.classes.textField}
        SelectProps={{
          MenuProps: {}
        }}
        helperText="Please select"
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
    return (
      <div>
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
              {filterBy('user', 'User')}
              {filterBy('operation', 'Operation')}
              {filterBy('status', 'Status')}
            </form>
          </DialogContent>
          <DialogActions>
            <Button onClick={props.handleClose} color="primary">
              Clear filters
            </Button>
            <Button onClick={props.handleClose} color="primary">
              Apply
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }
}

const FilterDialog = connect(mapStateToProps, mapDispatchToProps)(
  withStyles(styles)(FilterDialogRaw)
)

export default FilterDialog

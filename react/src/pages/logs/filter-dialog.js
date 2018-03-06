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
  return state.logs.filters
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
  render() {
    let props = this.props
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
              <TextField
                id="select-field"
                select
                label="Select"
                value={1}
                onChange={() => {}}
                className={props.classes.textField}
                SelectProps={{
                  MenuProps: {}
                }}
                helperText="Please select your currency"
                margin="normal"
              >
                {[
                  {
                    value: 1,
                    label: 'qwe'
                  }
                ].map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField margin="normal" id="name" label="User" />
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

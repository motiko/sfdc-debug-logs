import React from 'react'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import MenuItem from 'material-ui/Menu/MenuItem'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from 'material-ui/Dialog'
import { connect } from 'react-redux'
import { updateFontSize, updateTheme } from '../actions'
import { logThemes } from './log-themes'
import { withStyles } from 'material-ui/styles'

const styles = theme => ({
  textField: {
    marginLeft: 2 * theme.spacing.unit,
    marginRight: 2 * theme.spacing.unit,
    width: 200
  }
})

@withStyles(styles)
@connect(
  state => state.logsPage.styleConfig,
  dispatch => ({
    toggleStyleDialog: () => dispatch(toggleStyleDialog()),
    updateFontSize: newSize => dispatch(updateFontSize(newSize)),
    updateTheme: newTheme => dispatch(updateTheme(newTheme))
  })
)
export default class StyleDialog extends React.Component {
  render() {
    const { onClose, open, fontSize, theme, classes } = this.props
    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-dialog-title">Log View Style</DialogTitle>
        <DialogContent>
          <form>
            <TextField
              id="number"
              label="Font Size"
              value={fontSize}
              onChange={e => this.props.updateFontSize(e.target.value)}
              className={classes.textField}
              type="number"
              margin="normal"
            />
            <TextField
              select
              label="Log Color Theme"
              className={classes.textField}
              value={this.props.theme}
              onChange={e => this.props.updateTheme(e.target.value)}
              helperText="Please select log color theme"
              margin="normal"
            >
              {Object.keys(logThemes).map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

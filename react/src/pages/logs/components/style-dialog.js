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
import { defaultLogThemes } from '../constants'
import { withStyles } from 'material-ui/styles'
import { FormControl } from 'material-ui/Form'
import Grid from 'material-ui/Grid'
import ColorPickers from './color-pickers'
import Divider from 'material-ui/Divider'

const styles = theme => ({
  textField: {
    marginLeft: 2 * theme.spacing.unit,
    marginRight: 2 * theme.spacing.unit,
    width: 200
  },
  dialog: {
    height: '100%'
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
        maxWidth="md"
        classes={{
          paper: classes.dialog
        }}
      >
        <DialogTitle id="form-dialog-title">Log View Style</DialogTitle>
        <DialogContent>
          <form>
            <Grid container direction="column">
              <Grid item>
                <TextField
                  id="number"
                  label="Font Size"
                  value={fontSize}
                  onChange={e => this.props.updateFontSize(e.target.value)}
                  className={classes.textField}
                  type="number"
                  margin="normal"
                />
              </Grid>
              <Grid item>
                <TextField
                  fullWidth
                  select
                  label="Log Color Theme"
                  className={classes.textField}
                  value={theme.themeName}
                  onChange={e =>
                    this.props.updateTheme(defaultLogThemes[e.target.value])
                  }
                  helperText="Please select log color theme"
                  margin="normal"
                >
                  {Object.keys(defaultLogThemes).map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Divider />
            <ColorPickers theme={theme} />
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

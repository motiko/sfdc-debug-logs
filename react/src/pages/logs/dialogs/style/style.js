import React from 'react'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import MenuItem from 'material-ui/Menu/MenuItem'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogTitle
} from 'material-ui/Dialog'
import { connect } from 'react-redux'
import {
  updateFontSize,
  updateTheme,
  toggleTextWrap,
  toggleStyleDialog
} from './actions'
import { appTheme, logThemes } from '../../../../core/log/themes'
import { withStyles } from 'material-ui/styles'
import { FormControlLabel } from 'material-ui/Form'
import Grid from 'material-ui/Grid'
import Switch from 'material-ui/Switch'
import ColorPickers from './color-pickers'

const styles = theme => ({
  textField: {
    marginLeft: 2 * theme.spacing.unit,
    marginRight: 2 * theme.spacing.unit,
    width: 200
  },
  dialog: {
    height: '100%'
  },
  toggleContainer: { marginTop: 'auto', marginBottom: theme.spacing.unit }
})

class StyleDialog extends React.Component {
  render() {
    const { onClose, open, fontSize, theme, classes, textWrap } = this.props
    const { toggleTextWrap } = this.props
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
              <Grid container direction="row">
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
                <Grid item className={classes.toggleContainer}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={textWrap}
                        onChange={e => toggleTextWrap(e.target.value)}
                      />
                    }
                    label="Text Wrap"
                  />
                </Grid>
              </Grid>
              <Grid item>
                <TextField
                  fullWidth
                  select
                  label="Log Color Theme"
                  className={classes.textField}
                  value={theme.themeName}
                  onChange={e =>
                    this.props.updateTheme(appTheme(e.target.value))
                  }
                  helperText="Please select log color theme"
                  margin="normal"
                >
                  {Object.values(logThemes).map(option => (
                    <MenuItem key={option.name} value={option.name}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
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

export default withStyles(styles)(
  connect(
    state => state.logsPage.styleConfig,
    dispatch => ({
      toggleStyleDialog: () => dispatch(toggleStyleDialog()),
      toggleTextWrap: () => dispatch(toggleTextWrap()),
      updateFontSize: newSize => dispatch(updateFontSize(newSize)),
      updateTheme: newTheme => dispatch(updateTheme(newTheme))
    })
  )(StyleDialog)
)

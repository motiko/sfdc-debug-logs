import React from 'react'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from 'material-ui/Dialog'
import { connect } from 'react-redux'
import { updateFontSize } from '../actions'

@connect(
  state => state.logsPage.styleConfig,
  dispatch => ({
    toggleStyleDialog: () => dispatch(toggleStyleDialog()),
    updateFontSize: newSize => dispatch(updateFontSize(newSize))
  })
)
export default class StyleDialog extends React.Component {
  render() {
    const { onClose, open, fontSize } = this.props
    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-dialog-title">Log View Style</DialogTitle>
        <DialogContent>
          <TextField
            id="number"
            label="Font Size"
            value={fontSize}
            onChange={e => this.props.updateFontSize(e.target.value)}
            type="number"
            margin="normal"
          />
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

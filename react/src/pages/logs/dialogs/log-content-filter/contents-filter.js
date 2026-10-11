import React from 'react'
import { withStyles } from 'material-ui/styles'
import Button from 'material-ui/Button'
import Input from 'material-ui/Input'
import Chip from 'material-ui/Chip'
import Select from 'react-select'
import Paper from 'material-ui/Paper'
import { connect } from 'react-redux'
import Dialog, {
  DialogActions,
  DialogContent,
  DialogTitle
} from 'material-ui/Dialog'
import { allEventTypes } from '../../constants'
import 'react-select/dist/react-select.css'
import { styles } from './contents-filter-style'
import {
  addVisibleEvents,
  removeVisibleEvent,
  clearVisibleEvents,
  toggleContentsFilter
} from '../../actions'

class ContentsFilter extends React.Component {
  availableItems = () => {
    return allEventTypes
      .filter(eventType => {
        return this.props.selected.indexOf(eventType) == -1
      })
      .map(eventType => ({ label: eventType, value: eventType }))
  }

  componentDidMount() {
    if (this.inputElement) {
      this.inputElement.focus()
    }
  }

  render() {
    const {
      classes,
      selected,
      addAll,
      handleAdd,
      handleRemove,
      removeAll,
      toggleContentsFilter,
      isOpen
    } = this.props

    return (
      <Dialog open={isOpen} onClose={toggleContentsFilter} fullWidth>
        <DialogTitle id="form-dialog-title">Filter log contents</DialogTitle>
        <DialogContent>
          <Input
            inputRef={element => {
              this.inputElement = element
            }}
            fullWidth
            inputComponent={Select}
            inputProps={{
              classes,
              onChange: handleAdd,
              placeholder: 'Filter by event type',
              simpleValue: true,
              options: this.availableItems()
            }}
          />
          <Paper className={classes.selectedEvents} elevation={0}>
            {selected.map(item => (
              <Chip
                key={item}
                label={item}
                onDelete={() => handleRemove(item)}
                className={classes.chip}
              />
            ))}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={removeAll} color="primary">
            Remove All
          </Button>
          <Button onClick={addAll} color="primary">
            Add All
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

export default withStyles(styles)(
  connect(
    state => ({
      selected: state.logsPage.visibleEvents,
      isOpen: state.logsPage.contentsFilterOpen
    }),
    dispatch => ({
      handleAdd: newItem => dispatch(addVisibleEvents([newItem])),
      handleRemove: removedItem => dispatch(removeVisibleEvent(removedItem)),
      addAll: () => dispatch(addVisibleEvents(allEventTypes)),
      removeAll: () => dispatch(clearVisibleEvents()),
      toggleContentsFilter: () => dispatch(toggleContentsFilter())
    })
  )(ContentsFilter)
)

import React from 'react'
import PropTypes from 'prop-types'
import { withStyles } from 'material-ui/styles'
import Typography from 'material-ui/Typography'
import Button from 'material-ui/Button'
import Input from 'material-ui/Input'
import { MenuItem } from 'material-ui/Menu'
import ArrowDropDownIcon from 'material-ui-icons/ArrowDropDown'
import CancelIcon from 'material-ui-icons/Cancel'
import ArrowDropUpIcon from 'material-ui-icons/ArrowDropUp'
import ClearIcon from 'material-ui-icons/Clear'
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

class Option extends React.Component {
  handleClick = event => {
    this.props.onSelect(this.props.option, event)
  }

  render() {
    const { children, isFocused, onFocus } = this.props
    return (
      <MenuItem
        onFocus={onFocus}
        selected={isFocused}
        onClick={this.handleClick}
        component="div"
      >
        {children}
      </MenuItem>
    )
  }
}

@withStyles(styles)
@connect(
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
)
export default class ContentsFilter extends React.Component {
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

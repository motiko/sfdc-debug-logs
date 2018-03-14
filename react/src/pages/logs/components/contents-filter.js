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
import { allEventTypes } from '../../../constants'
import 'react-select/dist/react-select.css'
import { styles } from './contents-filter-style'

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
export default class ContentsFilter extends React.Component {
  state = {
    selected: []
  }

  handleAdd = newItem => {
    this.setState(prevState => ({
      ...prevState,
      selected: [...prevState.selected, newItem]
    }))
  }

  handleRemove = toRemove => {
    this.setState(oldState => ({
      ...oldState,
      selected: [...oldState.selected.filter(item => item !== toRemove)]
    }))
  }

  addAll = () => this.setState({ selected: allEventTypes })

  availableItems = () => {
    return allEventTypes
      .filter(eventType => {
        return this.state.selected.indexOf(eventType) == -1
      })
      .map(eventType => ({ label: eventType, value: eventType }))
  }

  render() {
    const { classes } = this.props
    const { selected } = this.state

    return (
      <Paper className={classes.root}>
        <Typography variant="display3" className={classes.title} gutterBottom>
          Filter log contents
          <span style={{ float: 'right' }}>
            <Button onClick={() => {}} color="primary">
              Remove All
            </Button>
            <Button onClick={this.addAll} color="primary">
              Add All
            </Button>
          </span>
        </Typography>
        <Input
          fullWidth
          inputComponent={Select}
          inputProps={{
            classes,
            onChange: this.handleAdd,
            placeholder: 'Filter by event type',
            simpleValue: true,
            options: this.availableItems()
          }}
        />
        <Paper className={classes.selectedEvents} elevation={0}>
          {this.state.selected.map(item => (
            <Chip
              key={item}
              label={item}
              onDelete={() => this.handleRemove(item)}
              className={classes.chip}
            />
          ))}
        </Paper>
      </Paper>
    )
  }
}

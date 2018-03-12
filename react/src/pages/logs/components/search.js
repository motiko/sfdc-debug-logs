import React from 'react'
import TextField from 'material-ui/TextField'
import SearchIcon from 'material-ui-icons/Search'
import ClearIcon from 'material-ui-icons/Clear'
import IconButton from 'material-ui/IconButton'
import Input, { InputLabel, InputAdornment } from 'material-ui/Input'
import Tooltip from 'material-ui/Tooltip'

export default class Search extends React.Component {
  constructor(props) {
    super(props)
    this.state = { searchTerm: '' }
    this.updateSearchTerm = this.updateSearchTerm.bind(this)
    this.handleKey = this.handleKey.bind(this)
  }

  handleKey(e) {
    if (e.keyCode === 13) {
      this.props.handleSearch(this.state.searchTerm)
    }
    if (e.keyCode === 27) {
      this.updateSearchTerm('')
    }
  }

  updateSearchTerm(newTerm) {
    if (newTerm === '') {
      this.props.handleSearch('')
    }
    this.setState({ searchTerm: newTerm })
  }

  render() {
    return (
      <div>
        <TextField
          id="search"
          type="search"
          color="accent"
          label="Find in Logs"
          value={this.state.searchTerm}
          onKeyUp={this.handleKey}
          onChange={e => this.updateSearchTerm(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Search">
                  <IconButton
                    color="contrast"
                    onClick={() =>
                      this.props.handleSearch(this.state.searchTerm)
                    }
                  >
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            )
          }}
        />
      </div>
    )
  }
}

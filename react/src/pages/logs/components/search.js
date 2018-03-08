import React from 'react'
import TextField from 'material-ui/TextField'
import SearchIcon from 'material-ui-icons/Search'
import ClearIcon from 'material-ui-icons/Clear'
import IconButton from 'material-ui/IconButton'
import Input, { InputLabel, InputAdornment } from 'material-ui/Input'

export default function Search(props) {
  function handleKey(e) {
    if (e.keyCode === 13) {
      props.handleSearch()
    }
    if (e.keyCode === 27) {
      props.handleRefresh()
      props.updateSearchTerm('')
    }
  }

  const searchTerm = props.searchTerm
  return (
    <div>
      <Input
        type="text"
        color="accent"
        value={searchTerm}
        onChange={e => props.updateSearchTerm(e.target.value)}
        onKeyUp={handleKey}
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              mini="mini"
              style={{ top: '0.3em' }}
              onClick={() => props.updateSearchTerm('')}
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        }
      />
      <IconButton color="contrast" onClick={props.handleSearch}>
        <SearchIcon />
      </IconButton>
    </div>
  )
}

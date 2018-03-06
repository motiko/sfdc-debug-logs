import React from 'react'
import TextField from 'material-ui/TextField'
import SearchIcon from 'material-ui-icons/Search'
import IconButton from 'material-ui/IconButton'

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
      <TextField
        color="accent"
        value={searchTerm}
        onChange={e => props.updateSearchTerm(e.target.value)}
        onKeyUp={handleKey}
      />
      <IconButton color="contrast" onClick={props.handleSearch}>
        <SearchIcon />
      </IconButton>
    </div>
  )
}

import React from 'react'
import TextField from 'material-ui/TextField'
import SearchIcon from 'material-ui-icons/Search'
import IconButton from 'material-ui/IconButton'

export default function Search (props) {
  function handleKey (e) {
    if (e.keyCode == 13) { props.handleSearch() }
    if (e.keyCode == 27) {
      props.handleRefresh()
      props.updateSearchTerm({target: {value: ''}})
    }
  }

  const searchTerm = props.searchTerm
  return (<div >
    <TextField color='accent' value={props.searchTerm} onChange={props.updateSearchTerm} onKeyUp={handleKey} />
    <IconButton color='contrast' onClick={props.handleSearch} >
      <SearchIcon />
    </IconButton>
  </div>)
}

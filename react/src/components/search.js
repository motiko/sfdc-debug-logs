import React from 'react'
import TextField from 'material-ui/TextField'
import SearchIcon from 'material-ui/svg-icons/action/search'
import IconButton from 'material-ui/IconButton'
import {styles} from '../styles'

export default function Search(props) {
  function handleKey(e) {
    if (e.keyCode == 13)
      props.handleSearch()
    if (e.keyCode == 27) {
      props.handleRefresh()
      props.updateSearchTerm({target:{value:''}})
    }
  }

  const searchTerm = props.searchTerm
  return (<span style={{
      display: "inline-block"
    }}>
    <TextField hintText="Search" value={props.searchTerm} style={{
        margin: '0px 1em'
      }} onChange={props.updateSearchTerm} onKeyUp={handleKey}/>
    <IconButton onClick={props.handleSearch} style={styles.medium} tooltip="Search" iconStyle={styles.mediumIcon}>
      <SearchIcon/>
    </IconButton>
  </span>)

}

import React from 'react'
import RefreshIcon from 'material-ui-icons/Autorenew'
import DeleteIcon from 'material-ui-icons/DeleteForever'
import { CircularProgress } from 'material-ui/Progress';
import IconButton from 'material-ui/IconButton'

export default function LogButtons(props) {
  const loading = props.loading
  return (<div>
    <IconButton tooltip="(R)eload" onClick={props.handleRefresh} >
      <RefreshIcon/>
    </IconButton>
    <IconButton onClick={props.handleDeleteAll} tooltip="Delete (A)ll">
      <DeleteIcon/>
    </IconButton>
    {loading ? <CircularProgress/> : null}
  </div>)
}

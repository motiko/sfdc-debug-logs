import React from 'react'
import RefreshIcon from 'material-ui/svg-icons/action/autorenew'
import DeleteIcon from 'material-ui/svg-icons//action/delete-forever'
import CircularProgress from 'material-ui/CircularProgress'
import IconButton from 'material-ui/IconButton'
import {styles} from '../styles'

export default function LogButtons(props) {
  const loading = props.loading
  return (<div>
    <IconButton tooltip="(R)eload" onClick={props.handleRefresh} >
      <RefreshIcon/>
    </IconButton>
    <IconButton onClick={props.handleDeleteAll} tooltip="Delete (A)ll">
      <DeleteIcon/>
    </IconButton>
    <CircularProgress style={{
        display: loading
          ? 'inline'
          : 'none',
        margin: '1em'
      }}/>
  </div>)
}

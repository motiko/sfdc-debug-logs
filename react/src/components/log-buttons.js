import React from 'react'
import RefreshIcon from 'material-ui/svg-icons/action/autorenew'
import DeleteIcon from 'material-ui/svg-icons//action/delete-forever'
import CircularProgress from 'material-ui/CircularProgress'
import IconButton from 'material-ui/IconButton'
import {styles} from '../styles'

export default function LogButtons(props) {
  const loading = props.loading
  return (<span style={{
      display: "inline-block"
    }}>
    <IconButton tooltip="(R)eload" onClick={props.handleRefresh} style={styles.medium} iconStyle={styles.mediumIcon}>
      <RefreshIcon/>
    </IconButton>
    <IconButton style={styles.medium} onClick={props.handleDeleteAll} tooltip="Delete (A)ll" iconStyle={styles.mediumIcon}>
      <DeleteIcon/>
    </IconButton>
    <CircularProgress style={{
        display: loading
          ? 'inline'
          : 'none',
        margin: '1em'
      }}/>
  </span>)
}

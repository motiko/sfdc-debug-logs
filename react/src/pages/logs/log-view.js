import React from 'react'
import {connect} from 'react-redux'
import Drawer from 'material-ui/Drawer'
import Grid from 'material-ui/Grid'
import List, { ListItem, ListItemText } from 'material-ui/List'
import IconButton from 'material-ui/IconButton'
import CloseIcon from 'material-ui-icons/KeyboardArrowLeft'
import {Link} from 'react-router-dom'
import {fetchLogBody} from './actions'
import LogBody from './log-body.js'

class LogViewRaw extends React.Component {
  constructor (props) {
    super(props)
    this.state = {sideLogsOpen: true}
    this.toggleSideLogs = this.toggleSideLogs.bind(this)
  }

  toggleSideLogs () {
    this.setState((oldState) => ({ sideLogsOpen: !oldState.sideLogsOpen }))
  }

  componentWillMount () {
    this.props.fetchBody(this.props.match.params.id)
  }

  getBody (id) {
    return this.props.logs[id] ? this.props.logs[id]['body'] : ''
  }

  render () {
    const props = this.props
    const sideLogsView = () => (<Grid item xs={3} >
      <IconButton onClick={this.toggleSideLogs}>
        <CloseIcon />
      </IconButton>
      <List>
        <ListItem button onClick={() => props.history.push(`/logs/${123}`)}>
          <ListItemText primary='Hello' secondary='World' />
        </ListItem>
        <ListItem button>
          <ListItemText primary='Hello' secondary='World' />
        </ListItem>
      </List>
    </Grid>)
    return (
      <Grid container direction='col' justify='flex-start'>
        { this.state.sideLogsOpen ? sideLogsView() : null }
        <Grid item xs={this.state.sideLogsOpen ? 9 : 12}>
          <LogBody body={this.getBody(props.match.params.id)} />
        </Grid>
      </Grid>)
  }
}

const mapStateToProps = (state) => ({logs: state.logs.logs})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: (logId) => dispatch(fetchLogBody(logId))
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

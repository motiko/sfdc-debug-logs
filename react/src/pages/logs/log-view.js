import React from 'react'
import { connect } from 'react-redux'
import List, { ListItem, ListItemText } from 'material-ui/List'
import ListSubheader from 'material-ui/List/ListSubheader'
import Button from 'material-ui/Button'
import CloseIcon from 'material-ui-icons/KeyboardArrowLeft'
import OpenIcon from 'material-ui-icons/KeyboardArrowRight'
import { fetchLogBody } from './actions'
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
    const sideLogsOpen = this.state.sideLogsOpen
    const openLog = (logId) => {
      this.props.fetchBody(logId)
      props.history.push(`/logs/${logId}`)
    }
    const toListItem = (log) => {
      return (
        <ListItem button onClick={() => openLog(log.Id)} key={log.Id}>
          <ListItemText primary={log.StartTime} secondary={log.Operation} />
        </ListItem>
      )
    }
    const sideLogsView = () => (
      <div style={{ paddingLeft: 0, position: 'fixed', left: 0, top: 64, bottom: 0, overflowY: 'scroll', width: sideLogsOpen ? '25%' : '0%' }}>
        <List style={{ borderRightSize: '1px', width: '100%' }}>
          <ListSubheader style={{textAlign: 'right'}} >
            <Button fab mini onClick={this.toggleSideLogs} >
              <CloseIcon />
            </Button>
          </ListSubheader>
          {props.logs ? Object.values(props.logs).map(toListItem) : null}
        </List>
      </div>)
    return (
      <div>
        { sideLogsView()}
        <div style={{overflowY: 'scroll', position: 'fixed', right: 0, top: 64, bottom: 0, width: sideLogsOpen ? '75%' : '100%'}}>
          { !sideLogsOpen ? <Button fab mini onClick={this.toggleSideLogs} style={{position: 'fixed', left: '-25px', top: '74px'}}>
            <OpenIcon />
          </Button> : null
        }
          <LogBody body={this.getBody(props.match.params.id)} />
        </div>
      </div>)
  }
}

const mapStateToProps = (state) => ({logs: state.logs.logs})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: (logId) => dispatch(fetchLogBody(logId))
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

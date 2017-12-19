import React from 'react'
import { connect } from 'react-redux'
import List, { ListItem, ListItemText } from 'material-ui/List'
import ListSubheader from 'material-ui/List/ListSubheader'
import Button from 'material-ui/Button'
import CloseIcon from 'material-ui-icons/KeyboardArrowLeft'
import OpenIcon from 'material-ui-icons/KeyboardArrowRight'
import { fetchLogBody, toggleSideLogs } from './actions'
import LogBody from './log-body.js'

class LogViewRaw extends React.Component {

  componentWillMount () {
    this.props.fetchBody(this.props.match.params.id)
  }

  getBody (id) {
    return this.props.logs[id] ? this.props.logs[id]['body'] : ''
  }

  render () {
    const timeFormatter = Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })
    const props = this.props
    const sideLogsOpen = this.props.sideLogsOpen
    const curLogId = props.match.params.id
    const openLog = (logId) => {
      props.fetchBody(logId)
      props.history.push(`/logs/${logId}`)
    }
    const toListItem = (log) => {
      if (log.not_matches_search) return
      const rawdate = new Date(log.StartTime)
      const dateStr = timeFormatter.format(rawdate)
      const isCurLog = log.Id === curLogId
      return (
        <ListItem button={!isCurLog} onClick={() => { if (!isCurLog) openLog(log.Id) }} key={log.Id} style={isCurLog ? {boxShadow: '-4px 0 gray'} : {}}>
          <ListItemText primary={`${dateStr}    ${log.DurationMilliseconds}ms`} secondary={`${log.Operation}    ${log.LogLength / 1000}k`} />
        </ListItem>
      )
    }
    return (
      <div>
        <div style={{ paddingLeft: 0, position: 'fixed', left: 0, top: 64, bottom: 0, overflowY: 'scroll', overflowX: 'hidden', width: sideLogsOpen ? '20%' : '0%' }}>
          <List style={{ borderRightSize: '1px', width: '100%', paddingLeft: 15 }}>
            {props.logs ? Object.values(props.logs).map(toListItem) : null}
          </List>
        </div>
        <div style={{overflowY: 'scroll', position: 'fixed', right: 0, top: 64, bottom: 0, width: sideLogsOpen ? '80%' : '100%'}}>
          <Button fab mini onClick={props.toggleSideLogs} style={{position: 'fixed', left: '-15px', top: '64px'}}>
            {sideLogsOpen ? <CloseIcon /> : <OpenIcon />}
          </Button>
          <LogBody body={this.getBody(curLogId)} />
        </div>
      </div>)
  }
}

const mapStateToProps = (state) => ({logs: state.logs.logs, sideLogsOpen: state.logs.sideLogsOpen})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: (logId) => dispatch(fetchLogBody(logId)),
  toggleSideLogs: () => dispatch(toggleSideLogs())
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

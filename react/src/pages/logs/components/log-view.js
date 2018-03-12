import React from 'react'
import { connect } from 'react-redux'
import List, { ListItem, ListItemText } from 'material-ui/List'
import Button from 'material-ui/Button'
import CloseIcon from 'material-ui-icons/KeyboardArrowLeft'
import OpenIcon from 'material-ui-icons/KeyboardArrowRight'
import ParsedLog from './parsed-log.js'
import { fetchLogBody, toggleSideLogs } from '../actions'
import { filterLogs } from '../utils'
import { maxLogSizeToParse } from '../constants'
import { logThemes } from './log-themes'

const mapStateToProps = state => ({
  logs: state.logsPage.logs,
  sideLogsOpen: state.logsPage.sideLogsOpen,
  logBodies: state.logsPage.logBodies,
  filters: state.logsPage.filters,
  notMatchingSearchLogs: state.logsPage.notMatchingSearchLogs,
  styleConfig: state.logsPage.styleConfig
})

const mapDispatchToProps = dispatch => ({
  fetchLogBody: logId => dispatch(fetchLogBody(logId)),
  toggleSideLogs: () => dispatch(toggleSideLogs())
})

@connect(mapStateToProps, mapDispatchToProps)
export default class LogView extends React.Component {
  componentWillMount() {
    this.props.fetchLogBody(this.props.match.params.id)
  }

  getBody(id) {
    return this.props.logBodies[id] ? this.props.logBodies[id] : ''
  }

  render() {
    const timeFormatter = Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    })
    const props = this.props
    const sideLogsOpen = this.props.sideLogsOpen
    const curLogId = props.match.params.id
    const openLog = logId => {
      props.fetchLogBody(logId)
      props.history.push(`/logs/${logId}`)
    }
    const toListItem = log => {
      const rawdate = new Date(log.StartTime)
      const dateStr = timeFormatter.format(rawdate)
      const isCurLog = log.Id === curLogId
      return (
        <ListItem
          button={!isCurLog}
          onClick={() => {
            if (!isCurLog) openLog(log.Id)
          }}
          key={log.Id}
          style={isCurLog ? { boxShadow: '-4px 0 gray' } : {}}
        >
          <ListItemText
            primary={`${dateStr}    ${log.DurationMilliseconds}ms`}
            secondary={`${log.Operation}    ${log.LogLength / 1000}k`}
          />
        </ListItem>
      )
    }
    const logBody = this.getBody(curLogId)
    return (
      <div>
        <div
          style={{
            paddingLeft: 0,
            position: 'fixed',
            left: 0,
            top: 64,
            bottom: 0,
            overflowY: 'scroll',
            overflowX: 'hidden',
            width: sideLogsOpen ? '20%' : '0%'
          }}
        >
          <List
            style={{ borderRightSize: '1px', width: '100%', paddingLeft: 15 }}
          >
            {props.logs
              ? filterLogs(
                  Object.values(props.logs),
                  props.filters,
                  props.notMatchingSearchLogs
                ).map(toListItem)
              : null}
          </List>
        </div>
        <div
          style={{
            overflowY: 'scroll',
            position: 'fixed',
            right: 0,
            top: 64,
            bottom: 0,
            width: sideLogsOpen ? '80%' : '100%',
            backgroundColor: logThemes[props.styleConfig.theme].background
          }}
        >
          <Button
            fab
            mini
            onClick={props.toggleSideLogs}
            style={{ position: 'fixed', left: '-15px', top: '64px' }}
          >
            {sideLogsOpen ? <CloseIcon /> : <OpenIcon />}
          </Button>
          <ParsedLog body={logBody} style={props.styleConfig} />
        </div>
      </div>
    )
  }
}

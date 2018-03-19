import React from 'react'
import { connect } from 'react-redux'
import List, { ListItem, ListItemText } from 'material-ui/List'
import Button from 'material-ui/Button'
import ArrowLeft from 'material-ui-icons/KeyboardArrowLeft'
import ArrowRight from 'material-ui-icons/KeyboardArrowRight'
import FilterList from 'material-ui-icons/FilterList'
import Tooltip from 'material-ui/Tooltip'
import { withStyles } from 'material-ui/styles'
import ParsedLog from './parsed-log.js'
import { fetchLogBody, toggleSideLogs, toggleContentsFilter } from '../actions'
import { filterLogs } from '../utils'
import { maxLogSizeToParse } from '../constants'
import ContentsFilter from './contents-filter'

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
  toggleSideLogs: () => dispatch(toggleSideLogs()),
  toggleContentsFilter: () => dispatch(toggleContentsFilter())
})

const styles = theme => ({
  sideLogs: {
    paddingLeft: 0,
    position: 'fixed',
    left: 0,
    top: 64,
    bottom: 0,
    overflowY: 'scroll',
    overflowX: 'hidden',
    background: theme.palette.background.default,
    height: '100%'
  },
  logView: {
    overflowY: 'scroll',
    position: 'fixed',
    right: 0,
    top: theme.spacing.unit * 8,
    bottom: 0
  },
  container: {
    background: theme.palette.background.default
  },
  sideLogsToggle: {
    position: 'fixed',
    left: -(theme.spacing.unit * 2),
    top: theme.spacing.unit * 9
  },
  contentsFilterToggle: {
    position: 'fixed',
    right: theme.spacing.unit * 3,
    top: theme.spacing.unit * 9,
    zIndex: 999
  }
})

@withStyles(styles)
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
    const { sideLogsOpen, contentsFilterOpen, classes } = this.props
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
      <div className={classes.container}>
        <div
          style={{
            width: sideLogsOpen ? '20%' : '0%'
          }}
          className={classes.sideLogs}
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
            width: sideLogsOpen ? '80%' : '100%',
            backgroundColor: props.styleConfig.theme.background
          }}
          className={classes.logView}
        >
          <Button
            fab
            mini
            onClick={props.toggleSideLogs}
            className={classes.sideLogsToggle}
          >
            {sideLogsOpen ? <ArrowLeft /> : <ArrowRight />}
          </Button>

          <ParsedLog body={logBody} logStyleConfig={props.styleConfig} />
          <Tooltip title="Filter log content" placement="left-end">
            <Button
              fab
              mini
              onClick={props.toggleContentsFilter}
              className={classes.contentsFilterToggle}
            >
              <FilterList />
            </Button>
          </Tooltip>
          <ContentsFilter />
        </div>
      </div>
    )
  }
}

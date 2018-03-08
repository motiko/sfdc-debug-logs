import React from 'react'
import Snackbar from 'material-ui/Snackbar'
import ChatIcon from 'material-ui-icons/Chat'
import HomeIcon from 'material-ui-icons/Home'
import Button from 'material-ui/Button'
import { Link, Route, Switch } from 'react-router-dom'
import Toolbar from 'material-ui/Toolbar'
import AppBar from 'material-ui/AppBar'
import Grid from 'material-ui/Grid'
import RefreshIcon from 'material-ui-icons/Autorenew'
import DeleteIcon from 'material-ui-icons/DeleteForever'
import FilterList from 'material-ui-icons/FilterList'
import TextField from 'material-ui/TextField'
import { CircularProgress } from 'material-ui/Progress'
import IconButton from 'material-ui/IconButton'
import { connect } from 'react-redux'
import LogView from './components/log-view'
import TrackingLogs from './components/tracking-logs'
import Search from './components/search'
import LogsTable from './components/logs-table'
import FilterDialog from './components/filter-dialog'
import {
  loadLogs,
  setMessage,
  deleteAll,
  search,
  updateSearchTerm,
  updateMaxLogs,
  toggleFiltersDialog
} from './actions'
import { filterLogs } from './utils'

const mapStateToProps = state => {
  return state.logsPage
}

const mapDispatchToProps = dispatch => ({
  refresh: () => dispatch(loadLogs()),
  setMessage: msg => dispatch(setMessage(msg)),
  deleteAll: () => dispatch(deleteAll()),
  search: searchTerm => dispatch(search(searchTerm)),
  updateSearchTerm: newTerm => dispatch(updateSearchTerm(newTerm)),
  updateMaxLogs: newMaxLogs => dispatch(updateMaxLogs(newMaxLogs)),
  toggleFiltersDialog: () => dispatch(toggleFiltersDialog())
})

class LogsPageRaw extends React.Component {
  componentDidCatch(error, info) {
    setMessage(`Error: ${error}`)
  }

  componentDidMount() {
    const props = this.props
    props.refresh()
    document.body.addEventListener('keyup', e => {
      if (e.target.type === 'text') {
        return
      }
      const key = e.key
      const funMap = {
        r: props.refresh,
        a: props.deleteAll
      }
      if (funMap[key]) {
        funMap[key]()
      }
    })
  }

  possibleRangeValues() {
    const logs = this.props.logs
    const lengthes = Object.values(logs).map(l => l.LogLength)
    const durations = Object.values(logs).map(l => l.DurationMilliseconds)
    const res = {
      length:
        lengthes.length > 0
          ? { max: Math.max(...lengthes), min: Math.min(...lengthes) }
          : { max: 10, min: 0 },
      duration:
        durations.length > 0
          ? { max: Math.max(...durations), min: Math.min(...durations) }
          : { max: 10, min: 0 }
    }
    return res
  }

  possibleFieldValues() {
    const unique = (value, index, array) => {
      return array.indexOf(value) === index
    }
    const logs = this.props.logs
    const allValues = Object.values(logs).reduce(
      (acc, cur) => ({
        operation: [...acc.operation, cur.Operation],
        status: [...acc.status, cur.Status],
        user: [...acc.user, cur.LogUser.Name]
      }),
      {
        operation: [],
        status: [],
        user: []
      }
    )
    return {
      operation: allValues.operation.filter(unique),
      status: allValues.status.filter(unique),
      user: allValues.user.filter(unique)
    }
  }

  render() {
    const props = this.props
    return (
      <Grid
        container
        direction="column"
        style={{ paddingTop: '64px', overflow: 'hidden' }}
      >
        <AppBar position="fixed" style={{ height: '64px' }}>
          <Toolbar>
            <Grid container direction="row" justify="space-between">
              <Grid item xs={12} sm={6}>
                <Grid container direction="row" justify="flex-start">
                  <Grid item>
                    <Link to="/">
                      <IconButton color="contrast">
                        <HomeIcon />
                      </IconButton>
                    </Link>
                  </Grid>
                  <Grid item>
                    <Search
                      color="contrast"
                      handleSearch={() => props.search(props.searchTerm)}
                      handleRefresh={props.refresh}
                      searchTerm={props.searchTerm}
                      updateSearchTerm={props.updateSearchTerm}
                    />
                  </Grid>
                  <Grid item>
                    <div>
                      <IconButton
                        color="contrast"
                        onClick={props.toggleFiltersDialog}
                      >
                        <FilterList />
                      </IconButton>
                      <IconButton color="contrast" onClick={props.refresh}>
                        <RefreshIcon />
                      </IconButton>
                      <IconButton color="contrast" onClick={props.deleteAll}>
                        <DeleteIcon />
                      </IconButton>
                      {props.loading ? (
                        <CircularProgress style={{ color: 'white' }} />
                      ) : null}
                    </div>
                  </Grid>
                </Grid>
              </Grid>
              <FilterDialog
                open={props.filtersDialogOpen}
                possibleFieldValues={this.possibleFieldValues()}
                possibleRangeValues={this.possibleRangeValues()}
              />
              <Grid item>
                <TextField
                  value={props.maxLogs}
                  type="number"
                  onChange={e => props.updateMaxLogs(e.target.value)}
                  label="Max Logs"
                  placeholder="1"
                  style={{ width: '6em', marginBottom: 2 }}
                  onBlur={props.refresh}
                />
                <Link to="/feedback">
                  <Button color="contrast">
                    <ChatIcon />
                    Give Feedback
                  </Button>
                </Link>
                <TrackingLogs sf={props.sf} />
              </Grid>
            </Grid>
          </Toolbar>
          <Snackbar
            open={props.message !== ''}
            autoHideDuration={1000}
            onClose={() => props.setMessage('')}
            message={props.message}
          />
        </AppBar>
        <Switch>
          <Route
            path="/logs/:id"
            render={ownProps => <LogView {...ownProps} />}
          />
          <Route
            render={ownProps => (
              <LogsTable
                logs={filterLogs(
                  props.logs,
                  props.filters,
                  props.notMatchingSearchLogs
                )}
                refreshLogs={props.refresh}
                {...ownProps}
              />
            )}
          />
        </Switch>
      </Grid>
    )
  }
}

const LogsPage = connect(mapStateToProps, mapDispatchToProps)(LogsPageRaw)

export default LogsPage

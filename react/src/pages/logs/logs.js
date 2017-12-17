import React from 'react'
import Snackbar from 'material-ui/Snackbar'
import ChatIcon from 'material-ui-icons/Chat'
import HomeIcon from 'material-ui-icons/Home'
import Button from 'material-ui/Button'
import {Link, Route, Switch} from 'react-router-dom'
import Toolbar from 'material-ui/Toolbar'
import AppBar from 'material-ui/AppBar'
import Grid from 'material-ui/Grid'
import RefreshIcon from 'material-ui-icons/Autorenew'
import DeleteIcon from 'material-ui-icons/DeleteForever'
import { CircularProgress } from 'material-ui/Progress'
import IconButton from 'material-ui/IconButton'
import {connect} from 'react-redux'
import LogView from './log-view'
import TrackingLogs from './tracking-logs'
import Search from './search'
import LogsTable from './logs-table'
import {loadLogs, setMessage, deleteAll, search} from './actions'

const mapStateToProps = (state) => {
  return state.logs
}

const mapDispatchToProps = (dispatch) => ({
  refresh: () => dispatch(loadLogs()),
  setMessage: (msg) => dispatch(setMessage(msg)),
  deleteAll: () => dispatch(deleteAll()),
  search: (searchTerm) => dispatch(search(searchTerm))
})

class LogsPageRaw extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      searchTerm: ''
    }
    this.updateSearchTerm = this.updateSearchTerm.bind(this)
  }

  componentDidCatch (error, info) {
    setMessage(`Error: ${error}`)
  }

  componentDidMount () {
    const props = this.props
    props.refresh()
    document.body.addEventListener('keyup', (e) => {
      if (e.target.type === 'text') { return }
      const key = e.key
      const funMap = {
        'r': props.refresh,
        'a': props.deleteAll
      }
      if (funMap[key]) { funMap[key]() }
    })
  }

  updateSearchTerm (e) {
    this.setState({searchTerm: e.target.value})
  }

  render () {
    const props = this.props
    return (<div style={{
      paddingTop: 80
    }}>
      <AppBar position='fixed'>
        <Toolbar>
          <Grid container='container' direction='row' justify='space-between'>
            <Grid item='item' xs={12} sm={6}>
              <Grid container='container' direction='row' justify='flex-start'>
                <Grid item='item'>
                  <Link to='/'>
                    <IconButton color='contrast' >
                      <HomeIcon />
                    </IconButton>
                  </Link>
                </Grid>
                <Grid item='item'>
                  <Search color='contrast' handleSearch={() => props.search(this.state.searchTerm)} handleRefresh={props.refresh} searchTerm={this.state.searchTerm} updateSearchTerm={this.updateSearchTerm} />
                </Grid>
                <Grid item='item'>
                  <div>
                    <IconButton color='contrast' onClick={props.refresh} >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton color='contrast' onClick={props.deleteAll} >
                      <DeleteIcon />
                    </IconButton>
                    {props.loading ? <CircularProgress color='contrast' /> : null}
                  </div>
                </Grid>
              </Grid>
            </Grid>
            <Grid item='item'>
              <Link to='/feedback'>
                <Button color='contrast'><ChatIcon />
                  Give Feedback</Button>
              </Link>
              <TrackingLogs sf={props.sf} />
            </Grid>
          </Grid>
        </Toolbar>
        <Snackbar open={props.message !== ''} message={props.message} onRequestClose={() => props.setMessage('')} />
      </AppBar>
      <Switch>
        <Route path='/logs/:id' render={ownProps => <LogView fetchBody={props.fetchLogBody} {...ownProps} />} />
        <Route render={ownProps => (<LogsTable logs={props.logs} refreshLogs={props.refresh} {...ownProps} />)} />
      </Switch>
    </div>)
  }
}

const LogsPage = connect(mapStateToProps, mapDispatchToProps)(LogsPageRaw)

export default LogsPage

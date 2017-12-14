import React from 'react'
import Snackbar from 'material-ui/Snackbar'
import ChatIcon from 'material-ui-icons/Chat'
import Button from 'material-ui/Button'
import {Link, Route, Switch} from 'react-router-dom'
import Toolbar from 'material-ui/Toolbar'
import AppBar from 'material-ui/AppBar'
import Grid from 'material-ui/Grid'
import {connect} from 'react-redux'
import LogView from './log-view'
import TrackingLogs from './tracking-logs'
import Search from './search'
import LogsTable from './logs-table'
import LogButtons from './log-buttons'
import {loadLogs, setMessage, deleteAll} from './actions'

const mapStateToProps = (state) => {
  return state.logs
}

const mapDispatchToProps = (dispatch) => ({
  refresh: ((sf) => dispatch(loadLogs(sf))),
  setMessage: ((msg) => dispatch(setMessage(msg))),
  deleteAll: ((sf) => dispatch(deleteAll(sf)))
})

class LogsPageComponent extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      loading: false,
      message: "",
      searchTerm: ""
    }
    this.search = this.search.bind(this)
    this.updateSearchTerm = this.updateSearchTerm.bind(this)
    this.fetchLogBody = this.fetchLogBody.bind(this)
    this.refresh = props.refresh.bind(this,props.sf)
    this.deleteAll = props.deleteAll.bind(this,props.sf)
  }

  // deleteAll() {
  //   this.setState({loading: true, searchTerm: ""})
  //   this.props.sf.deleteAll().then(() => {
  //     this.setState({message: "Removed logs from salesforce", loading: false})
  //   })
  //   this.setState({logs: []})
  // }

  componentDidCatch(error, info){
    this.setState({message: `Error: ${error}`})
  }

  fetchLogBody(id){
    return this.props.sf.logBody(id)
  }

  search() {
    const searchTerm = this.state.searchTerm
    this.setState({loading: true})
    const escapeRegExp = (str) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const searchRegex = new RegExp(escapeRegExp(searchTerm), 'gi');
    const logBodyPromises = this.state.logs.map(x => x.Id).map(x => ({id: x, promise: this.props.sf.logBody(x)}))
    const resultPromise = logBodyPromises.map((lbp) => lbp.promise.then((logBody) => ({id: lbp.id, found: searchRegex.test(logBody), body: logBody})))
    Promise.all(resultPromise).then((results) => {
      const foundIds = results.filter(r => r.found).map(r => r.id)
      this.setState((oldState) => {
        return {
          logs: oldState.logs.map(l => {
            l['not_matches_search'] = foundIds.indexOf(l.Id) == -1
            l['Body'] = results.find(r => r.id == l.Id)['Body']
            return l
          }),
          loading: false,
          message: `Found ${foundIds.length} matching logs`
        }
      })
    })
  }

  componentDidMount() {
    const props = this.props
    this.refresh()
    document.body.addEventListener('keyup', (e) => {
      if (e.target.type == "text")
        return
      const key = e.key
      const funMap = {
        'r': this.refresh,
        'a': this.deleteAll
      }
      if (funMap[key])
        funMap[key]()
    })
  }

  updateSearchTerm(e) {
    this.setState({searchTerm: e.target.value})
  }

  logById(id){
    this.state.logs.find(l=> l.Id == id)
  }

  render() {
    const props = this.props
    return (<div style={{ paddingTop: 80 }} >
      <AppBar position="fixed">
        <Toolbar>
        <Grid container direction="row" justify="space-between">
          <Grid item xs={12} sm={6}>
            <Grid container direction="row" justify="flex-start">
              <Grid item>
                <Search color="contrast" handleSearch={this.search} handleRefresh={this.refresh} searchTerm={this.state.searchTerm} updateSearchTerm={this.updateSearchTerm}/>
              </Grid>
              <Grid item >
                <LogButtons handleRefresh={this.refresh} handleDeleteAll={this.deleteAll} loading={props.loading}/>
              </Grid>
            </Grid>
          </Grid>
          <Grid item>
            <Link to="/feedback" >
              <Button color="contrast" ><ChatIcon/> Give Feedback</Button>
            </Link>
            <TrackingLogs sf={props.sf}/>
          </Grid>
        </Grid>
        </Toolbar>

        <Snackbar open={props.message != ""} message={props.message} onRequestClose={() => props.setMessage("")}/>
      </AppBar>
      <Switch>
        <Route path="/logs/:id" render={ownProps => <LogView fetchBody={this.fetchLogBody} {...ownProps}/>}/>
        <Route render={ownProps => (<LogsTable logs={props.logs} refreshLogs={this.refresh} {...ownProps}/>)}/>
      </Switch>
      </div>)
  }
}

const LogsPage = connect(mapStateToProps, mapDispatchToProps)(LogsPageComponent)

export default LogsPage

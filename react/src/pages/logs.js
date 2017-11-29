import React from 'react'
import TrackingLogs from '../components/tracking-logs'
import Search from '../components/search'
import LogsTable from '../components/logs-table'
import LogButtons from '../components/log-buttons'
import Snackbar from 'material-ui/Snackbar'
import {styles} from '../styles'
import ChatIcon from 'material-ui/svg-icons/communication/chat'
import FlatButton from 'material-ui/FlatButton'
import {Link, Route, Switch} from 'react-router-dom'
import LogView from '../components/log-view'
import {Toolbar, ToolbarGroup, ToolbarTitle} from 'material-ui/Toolbar'

export default class LogsPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      logs: [],
      loading: false,
      message: "",
      searchTerm: ""
    }
    this.refresh = this.refresh.bind(this)
    this.deleteAll = this.deleteAll.bind(this)
    this.search = this.search.bind(this)
    this.updateSearchTerm = this.updateSearchTerm.bind(this)
    this.fetchLogBody = this.fetchLogBody.bind(this)
  }

  handleSnackbarClose() {
    this.setState({message: ""})
  }

  deleteAll() {
    this.setState({loading: true, searchTerm: ""})
    this.props.sf.deleteAll().then(() => {
      this.setState({message: "Removed logs from salesforce", loading: false})
    })
    this.setState({logs: []})
  }

  refresh() {
    this.setState({loading: true, searchTerm: ""})
    this.props.sf.requestLogs().then((records) => {
      this.setState({logs: records, loading: false})
    }).catch((err) => {
      this.setState({showMessage: true, message: `Error occured: ${err.message}`, loading: false})
    })
  }

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
    return (<div style={{width:"100%"}}>
      <Toolbar>
        <ToolbarGroup firstChild={true}>
          <Search handleSearch={this.search} handleRefresh={this.refresh} searchTerm={this.state.searchTerm} updateSearchTerm={this.updateSearchTerm}/>
        </ToolbarGroup>
        <ToolbarGroup>
          <LogButtons handleRefresh={this.refresh} handleDeleteAll={this.deleteAll} loading={this.state.loading}/>
        </ToolbarGroup>
        <ToolbarGroup lastChild={true}>
        <TrackingLogs sf={this.props.sf}/>
        <Link to="/feedback">
          <FlatButton label="Give Feedback"  icon={<ChatIcon />}/>
        </Link>
        </ToolbarGroup>
      </Toolbar>
      <Snackbar open={this.state.message != ""} message={this.state.message} onRequestClose={() => this.handleSnackbarClose()}/>

      <Switch>
        <Route path="/logs/:id" render={props => <LogView fetchBody={this.fetchLogBody} {...props}/>}/>
        <Route render={props => (<LogsTable logs={this.state.logs} refreshLogs={this.refresh} {...props}/>)}/>
      </Switch>
    </div>)
  }
}

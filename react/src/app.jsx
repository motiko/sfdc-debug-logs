import React from 'react'
import ReactDOM from 'react-dom'
import Snackbar from 'material-ui/Snackbar'
import {List, ListItem} from 'material-ui/List'
import {
  Table,
  TableBody,
  TableFooter,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table'
import FloatingActionButton from 'material-ui/FloatingActionButton'
import RaisedButton from 'material-ui/RaisedButton'
import FlatButton from 'material-ui/FlatButton'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import TextField from 'material-ui/TextField'
import RefreshIcon from 'material-ui/svg-icons/action/autorenew'
import SearchIcon from 'material-ui/svg-icons/action/search'
import DeleteIcon from 'material-ui/svg-icons//action/delete-forever'
import CheckBlankIcon from 'material-ui/svg-icons/toggle/check-box-outline-blank'
import CheckIcon from 'material-ui/svg-icons/toggle/check-box'
import CircularProgress from 'material-ui/CircularProgress'
import Paper from 'material-ui/Paper'
import SF from './api/sf'
import IconButton from 'material-ui/IconButton'

////////////////   INIT //////////////////

function getParam(s) {
 const url = new URL(location.href)
 return url.searchParams.get(s)
}

const sf = new SF(getParam("host"), getParam("sid"))


////////////////////////Styles //////////////////////////

const styles = {
  mediumIcon: {
    width: 48,
    height: 48,
  },
  medium: {
    width: 96,
    height: 96,
    padding: 24,
  },
  button : {margin: '1em'}
}

////////////////////// UI /////////////////////////////
const App = () => (
  <MuiThemeProvider>
    <MainContainer/>
  </MuiThemeProvider>
)

class MainContainer extends React.Component{
  constructor(props){
    super(props)
    this.state = {logs: [], loading: false, message: ""}
    this.refresh = this.refresh.bind(this)
    this.deleteAll = this.deleteAll.bind(this)
    this.search = this.search.bind(this)
  }

  handleSnackbarClose() {
    this.setState({message: ""})
  }

  deleteAll() {
    sf.deleteAll().then(()=>{
      this.setState({ message: "Removed logs from salesforce" })
    })
    this.setState( { logs:[]} )
  }

  refresh() {
    this.setState({
      loading: true,
      searchTerm: ""
    })
    sf.requestLogs().then((records) => {
      this.setState({
        logs: records,
        loading: false
      })
    }).catch((err)=>{
      this.setState({
        showMessage: true,
        message: `Error occured: ${err.message}`,
        loading:false
      })
    })
  }

  search(searchTerm) {
    this.setState({loading: true})
    const escapeRegExp = (str) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const searchRegex = new RegExp(escapeRegExp(searchTerm), 'gi');
    const logBodyPromises = this.state.logs.map(x => x.Id).map(x => ({id: x, promise: sf.logBody(x)}))
    const resultPromise = logBodyPromises.map(
      (lbp) => lbp.promise.then((logBody) => ({id: lbp.id,
                    found: searchRegex.test(logBody)})))
    Promise.all(resultPromise).then((results)=> {
      const foundIds = results.filter(r => r.found).map(r => r.id)
      this.setState( (oldState) => {
        return {
                logs: oldState.logs.map(l => {
                    l['not_matches_search'] = foundIds.indexOf(l.Id) == -1
                    return l
                  }),
                loading:false
        }
      })
    })
  }

  componentDidMount(){
    this.refresh()
    document.body.addEventListener('keyup',(e) => {
      if(e.target.type == "text") return
      const key = e.key
      const funMap = {
        'r': this.refresh,
        's': () => {}
      }
      if(funMap[key])
        funMap[key]()
    })
  }

  render(){
    return (
     <div>
       <TopControls handleRefresh={this.refresh} handleSearch={this.search}
                    handleDeleteAll={this.deleteAll} loading={this.state.loading}/>
       <LogsTable logs={this.state.logs}/>
       <Snackbar open={this.state.message != ""} message={this.state.message}
           onRequestClose={() => this.handleSnackbarClose()}/>
     </div>)
  }
}

function TopControls(props) {
    const loading = props.loading
    return (
      <div style={{position:"relative"}}>
        <Search handleSearch={props.handleSearch}/>
        <IconButton tooltip="(R)eload" onClick={props.handleRefresh} style={styles.button}
                     iconStyle={styles.mediumIcon} style={styles.medium}>
          <RefreshIcon />
        </IconButton>
        <IconButton style={styles.button} onClick={props.handleDeleteAll} tooltip="Delete (A)ll"
                     iconStyle={styles.mediumIcon} style={styles.medium}>
          <DeleteIcon/>
        </IconButton>
        <CircularProgress style={{display:loading ? 'inline' : 'none',
                  margin: '1em'}}/>
        <TrackingLogs/>

      </div>)
}


class TrackingLogs extends React.Component {
  constructor(props){
    super(props)
    this.state = {isTracking: false}
    this.startLogging = this.startLogging.bind(this)
  }

  startLogging(){
    sf.startLogging().then(()=>{
      this.setState({isTracking: true})
    })
  }

  componentDidMount(){
    sf.isLogging()
      .then((isTracking) => {
        this.setState({isTracking})
        if(!isTracking) this.startLogging()
      })
  }

  render(){
    const style={position: "absolute", top: 7,left: 10}
    if(this.state.isTracking){
      return <FlatButton label="Logging Activity" disabled={true} style={style} icon={<CheckIcon />}/>
    }
    return (
      <FlatButton label="Start Logging" onClick={this.startLogging} style={style}
        icon={<CheckBlankIcon />}/>)
  }
}

class Search extends React.Component {
  constructor(props){
    super(props)
    this.state = {searchTerm: ""}
    this.updateTerm = this.updateTerm.bind(this)
    this.handleKey = this.handleKey.bind(this)
  }

  handleKey(e){
    if(e.keyCode==13) this.props.handleSearch(this.state.searchTerm)
    if(e.keyCode==27) this.props.handleRefresh()
  }

  updateTerm(e){
    this.setState({searchTerm: e.target.value})
  }

  render(){
    const searchTerm = this.state.searchTerm
    return (
    <span style={{display: "inline-block"}}>
      <TextField hintText="Search" value={searchTerm}
        style={{margin: '0px 1em'}}
        onChange={this.updateTerm} onKeyUp={this.handleKey}/>
      <IconButton  onClick={(e) => this.props.handleSearch(searchTerm)} style={{margin: '1em'}} tooltip="Search"
                     iconStyle={styles.mediumIcon} style={styles.medium}>
        <SearchIcon/>
      </IconButton>
    </span>)
  }
}

const LogsTable = (props) => {
  function openLog(index){
    browser.runtime.sendMessage({
        url: `https://${getParam('host')}/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${props.logs[index].Id}`,
        command: "openTab"
      });
  }

  const toLogView = (log, index) => {
    const style = {display: log['not_matches_search'] ? 'none' : 'table-row'}
    const timeString = log.StartTime.match(/T(\d\d:\d\d):/)[1]
    return (
        <TableRow key={log.Id} logid={log.Id} style={style}>
          <TableRowColumn>{timeString}</TableRowColumn>
          <TableRowColumn>{log.Operation}</TableRowColumn>
          <TableRowColumn>{log.Status}</TableRowColumn>
          <TableRowColumn>{log.LogUser.Name}</TableRowColumn>
          <TableRowColumn>{log.DurationMilliseconds + "ms"}</TableRowColumn>
          <TableRowColumn>{`${log.LogLength/1000} k`}</TableRowColumn>
        </TableRow>)
  }

  return (
  <Table onRowSelection={openLog}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn >Time</TableHeaderColumn>
        <TableHeaderColumn >Operation</TableHeaderColumn>
        <TableHeaderColumn >Status</TableHeaderColumn>
        <TableHeaderColumn >User</TableHeaderColumn>
        <TableHeaderColumn >Run Duration</TableHeaderColumn>
        <TableHeaderColumn >Length</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody showRowHover={true}  displayRowCheckbox={false} >
      {props.logs.map( toLogView)}
    </TableBody>
  </Table>)
}

function render(){
  ReactDOM.render(<App/>, document.getElementById("container"))
}
render()

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



//////////////////// UTILS //////////////////////
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

///////////////////  EVENTS & ACTIONS //////////

function search(){
  evil.loading = true
  render()
  const searchRegex = new RegExp(escapeRegExp(evil.searchTerm), 'gi');
  const logBodyPromises = evil.logs.map(x => x.Id).map(x => ({id: x, promise: sf.logBody(x)}))
  const resultPromise = logBodyPromises.map(
    (lbp) => lbp.promise.then((logBody) => ({id: lbp.id,
                  found: searchRegex.test(logBody)})))
  Promise.all(resultPromise).then((results)=> {
    const foundIds = results.filter(r => r.found).map(r => r.id)
    evil.logs.filter(l=> foundIds.indexOf(l.Id) == -1).forEach(l => {
      l['not_matches_search'] = true
    })
    evil.loading = false
    render()
  })
}

function updateTerm(e){
  evil.searchTerm = e.target.value
  render()
}

function refresh(){
  evil.loading = true
  render()
  sf.requestLogs().then((records) => {
    evil.logs = records
    console.log(records)
    evil.loading = false
    render()
  }).catch((err)=>{
    evil.loading = false
    evil.message = `Error occured: ${err.message}`
    evil.showMessage = true
    render()
  })
}

function deleteAll(){
  sf.deleteAll(evil.logs.map(l=>l.Id)).then(()=>{
    evil.message = "Removed logs from salesforce"
    evil.showMessage = true
    render()
  })
  evil.logs = []
  render()
}

function startLogging(){
  sf.startLogging().then(()=>{
    evil.isLogging = true
    render()
  })
}

//////////////////////// STYLES ////////////////////////////
const styles = {
  mediumIcon: {
    width: 48,
    height: 48,
  },
  medium: {
    width: 96,
    height: 96,
    padding: 24,
  }
};
////////////////////// UI /////////////////////////////
const App = () => (
  <MuiThemeProvider>
    <MainContainer/>
  </MuiThemeProvider>
)

const MainContainer = () => (
  <div>
    <TopControls/>
    <LogsTable logs={evil.logs}/>
    <Snackbar open={evil.showMessage} message={evil.message}
        onRequestClose={()=> {
            evil.showMessage = false
            evil.message = ""
            render()
        }}/>
  </div>
)

const buttonStyle = {margin: '1em'}

const TopControls = () => (
  <div style={{position:"relative"}}>
    <Search/>
    <IconButton tooltip="(R)eload" onClick={refresh} style={buttonStyle}
                 iconStyle={styles.mediumIcon} style={styles.medium}>
      <RefreshIcon />
    </IconButton>
    <IconButton style={buttonStyle} onClick={deleteAll} tooltip="Delete (A)ll"
                 iconStyle={styles.mediumIcon} style={styles.medium}>
      <DeleteIcon/>
    </IconButton>
    <CircularProgress style={{display: evil.loading ? 'inline' : 'none',
              margin: '1em'}}/>
    <TrackingLogs isTracking={evil.isLogging}/>
  </div>
)

const TrackingLogs = (props) => {
  let style={position: "absolute", top: 7,left: 10}
  if(props.isTracking){
    return (
      <FlatButton label="Logging Activity" disabled={true} style={style} icon={<CheckIcon />}/>
    )
  }else{
    return (
      <FlatButton label="Start Logging" onClick={startLogging} style={style}
        icon={<CheckBlankIcon />}/>
    )
  }
}



const Search = () => (
  <span style={{display: "inline-block"}}>
    <TextField hintText="Search" value={evil.searchTerm}
      style={{margin: '0px 1em'}}
      onChange={updateTerm} onKeyUp={(e) => {if(e.keyCode==13) search()}}/>
    <IconButton  onClick={search} style={{margin: '1em'}} tooltip="Search"
                   iconStyle={styles.mediumIcon} style={styles.medium}>
      <SearchIcon/>
    </IconButton>
  </span>
)

function openLog(index){
  browser.runtime.sendMessage({
      url: `https://${getParam('host')}/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${evil.logs[index].Id}`,
      command: "openTab"
    });
}

const LogsTable = (props) => (
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
  </Table>
)

const toLogView = (log, index) => {
  const style = {display: log['not_matches_search'] ? 'none' : 'table-row'}
  const timeString = log.StartTime.match(/T(\d\d:\d\d):/)[1]
  return (
      <TableRow key={log.Id} style={style}>
        <TableRowColumn>{timeString}</TableRowColumn>
        <TableRowColumn>{log.Operation}</TableRowColumn>
        <TableRowColumn>{log.Status}</TableRowColumn>
        <TableRowColumn>{log.LogUser.Name}</TableRowColumn>
        <TableRowColumn>{log.DurationMilliseconds + "ms"}</TableRowColumn>
        <TableRowColumn>{`${log.LogLength/1000} k`}</TableRowColumn>
      </TableRow>)
}

function render(){
  ReactDOM.render(<App/>, document.getElementById("container"))
}


////////////////   INIT //////////////////
var evil = {searchTerm: "", logs: [], loading: true, showMessage: false, message: ""}
var sf

function getParam(s) {
 const url = new URL(location.href)
 return url.searchParams.get(s)
}

function initSF(){
  sf = new SF(getParam("host"), getParam("sid"))
  // SF.host = getParam("host")
  // SF.sid = getParam("sid")
}

function init(){
  initSF()
  refresh()
  sf.isLogging().then((isLogging)=>{
    evil.isLogging = isLogging
    render()
  })
}

init()


////////////////   END OF INIT //////////////////

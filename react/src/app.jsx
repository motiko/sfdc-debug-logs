import React from 'react'
import ReactDOM from 'react-dom'
import Snackbar from 'material-ui/Snackbar';
import {List, ListItem} from 'material-ui/List';
import {
  Table,
  TableBody,
  TableFooter,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import RaisedButton from 'material-ui/RaisedButton';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import TextField from 'material-ui/TextField';
import RefreshIcon from 'material-ui/svg-icons/action/autorenew';
import SearchIcon from 'material-ui/svg-icons/action/search';
import DeleteIcon from 'material-ui/svg-icons//action/delete-forever';
import CircularProgress from 'material-ui/CircularProgress';
import Paper from 'material-ui/Paper';
import SF from './sf-api'

//////////////////// UTILS //////////////////////
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

///////////////////  EVENTS & ACTIONS //////////

function search(){
  evil.loading = true
  render()
  var searchRegex = new RegExp(escapeRegExp(evil.searchTerm), 'gi');
  let logBodyPromises = evil.logs.map(x => x.Id).map(x => ({id: x, promise: SF.logBody(x)}))
  let resultPromise = logBodyPromises.map(
    (lbp) => lbp.promise.then((logBody) => ({id: lbp.id,
                  found: searchRegex.test(logBody)})))
  Promise.all(resultPromise).then((results)=> {
    evil.logs = evil.logs.filter(l =>
      results.filter(r => r.found).map(r => r.id).indexOf(l.Id) > -1)
    evil.loading = false
    render()
  })
}

function updateTerm(e){
  evil.searchTerm = e.target.value

  render()
}

function refresh(){
  render()
  SF.requestLogs().then((records) => {
    evil.logs = records
    evil.loading = false
    render()
  }).catch((err)=>{
    evil.message = `Error occured: ${err.message}`
    evil.showMessage = true
    render()
  })
}

function deleteAll(){
  evil.message = "WOOT"
  evil.showMessage = true
  render()
}


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
  <div>
    <Search/>
    <FloatingActionButton onClick={refresh} style={buttonStyle}>
      <RefreshIcon/>
    </FloatingActionButton>
    <FloatingActionButton style={buttonStyle} onClick={deleteAll}>
      <DeleteIcon/>
    </FloatingActionButton>
    <CircularProgress style={{display: evil.loading ? 'inline' : 'none',
              margin: '1em'}}/>
  </div>
)

const Search = () => (
  <span style={{display: "inline-block"}}>
    <TextField hintText="Search" value={evil.searchTerm}
      style={{margin: '0px 1em'}}
      onChange={updateTerm} onKeyUp={(e) => {if(e.keyCode==13) search()}}/>
    <FloatingActionButton  onClick={search} style={{margin: '1em'}}>
      <SearchIcon/>
    </FloatingActionButton>
  </span>
)

function openLog(index){
  browser.runtime.sendMessage({
      url: `https://${SF.host}/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${evil.logs[index].Id}`,
      command: "openTab"
    });
}

const LogsTable = (props) => (
  <Table onRowSelection={openLog}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn tooltip="Time">Time</TableHeaderColumn>
        <TableHeaderColumn tooltip="Length">Length</TableHeaderColumn>
        <TableHeaderColumn tooltip="Status">Status</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody showRowHover={true}  displayRowCheckbox={false} >
      {props.logs.map( toLogView)}
    </TableBody>
  </Table>
)

const toLogView = (log, index) => {
  return (
      <TableRow key={log.Id}>
        <TableRowColumn>{log.StartTime}</TableRowColumn>
        <TableRowColumn>{log.LogLength}</TableRowColumn>
        <TableRowColumn>{log.Status}</TableRowColumn>
      </TableRow>)
}

function render(){
  ReactDOM.render(<App/>, document.getElementById("container"))
}


////////////////   INIT //////////////////
var evil = {searchTerm: "", logs: [], loading: true, showMessage: false, message: ""}

function initSF(){
  function getParam(s) {
   const url = new URL(location.href)
   return url.searchParams.get(s)
  }
  SF.host = getParam("host")
  SF.sid = getParam("sid")
}

function init(){
  initSF()
  refresh()
}

init()

////////////////   END OF INIT //////////////////

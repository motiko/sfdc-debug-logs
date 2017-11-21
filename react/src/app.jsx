import React from 'react'
import ReactDOM from 'react-dom'
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

////////////////   INIT //////////////////
var evil = {}

function initSF(){
  function getParam(s) {
   const url = new URL(location.href)
   return url.searchParams.get(s)
  }
  SF.host = getParam("host")
  SF.sid = getParam("sid")
}

function initEvil(){
  refresh()
}

function init(){
  initSF()
  initEvil()
}

function refresh(){
  SF.requestLogs().then((records) => {
    console.log(records)
    evil.logs = records
    render()
  })
}

init()

////////////////   END OF INIT //////////////////

const App = () => (
  <MuiThemeProvider>
    <MainContainer/>
  </MuiThemeProvider>
)

const MainContainer = () => (
  <div>
    <TopControls/>
    <LogsTable logs={evil.logs}/>
  </div>
)

const TopControls = () => (
  <div>
    <FloatingActionButton onClick={()=> refresh()}>
      <RefreshIcon/>
    </FloatingActionButton>
    <FloatingActionButton>
      <DeleteIcon/>
    </FloatingActionButton>
    <Search/>
  </div>
)

const Search = () => (
  <span>
    <TextField hintText="Search" />
    <FloatingActionButton>
      <SearchIcon/>
    </FloatingActionButton>
    <CircularProgress/>
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

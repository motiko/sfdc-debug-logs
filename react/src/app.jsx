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

///////////////////  EVENTS & ACTIONS //////////

document.body.addEventListener('keyup',(e) => {
  if(e.target.type == "text") return
  const key = e.key
  const funMap = {
    'r': refresh,
    's': () => {

    }
  }
  if(funMap[key])
    funMap[key]()
})

function refresh(){
  evil.loading = true
  evil.searchTerm = ""
  render()
  evil.sf.requestLogs().then((records) => {
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

const TopControls = () => {

  function deleteAll(){
    evil.sf.deleteAll().then(()=>{
      evil.message = "Removed logs from salesforce"
      evil.showMessage = true
      render()
    })
    evil.logs = []
    render()
  }

  return (
  <div style={{position:"relative"}}>
    <Search/>
    <IconButton tooltip="(R)eload" onClick={refresh} style={styles.button}
                 iconStyle={styles.mediumIcon} style={styles.medium}>
      <RefreshIcon />
    </IconButton>
    <IconButton style={styles.button} onClick={deleteAll} tooltip="Delete (A)ll"
                 iconStyle={styles.mediumIcon} style={styles.medium}>
      <DeleteIcon/>
    </IconButton>
    <CircularProgress style={{display: evil.loading ? 'inline' : 'none',
              margin: '1em'}}/>
    <TrackingLogs isTracking={evil.isLogging}/>
  </div>
)}

const TrackingLogs = (props) => {
  let style={position: "absolute", top: 7,left: 10}

  function startLogging(){
    evil.sf.startLogging().then(()=>{
      evil.isLogging = true
      render()
    })
  }

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

const Search = () => {
  function handleKey(e){
    if(e.keyCode==13) search()
    if(e.keyCode==27) refresh()

  }

  function updateTerm(e){
    evil.searchTerm = e.target.value
    render()
  }

  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  function search(){
    evil.loading = true
    render()
    const searchRegex = new RegExp(escapeRegExp(evil.searchTerm), 'gi');
    const logBodyPromises = evil.logs.map(x => x.Id).map(x => ({id: x, promise: evil.sf.logBody(x)}))
    const resultPromise = logBodyPromises.map(
      (lbp) => lbp.promise.then((logBody) => ({id: lbp.id,
                    found: searchRegex.test(logBody)})))
    Promise.all(resultPromise).then((results)=> {
      const foundIds = results.filter(r => r.found).map(r => r.id)
      evil.logs.forEach(l => {
        l['not_matches_search'] = foundIds.indexOf(l.Id) == -1
      })
      evil.loading = false
      render()
    })
  }

  return (
  <span style={{display: "inline-block"}}>
    <TextField hintText="Search" value={evil.searchTerm}
      style={{margin: '0px 1em'}}
      onChange={updateTerm} onKeyUp={handleKey}/>
    <IconButton  onClick={search} style={{margin: '1em'}} tooltip="Search"
                   iconStyle={styles.mediumIcon} style={styles.medium}>
      <SearchIcon/>
    </IconButton>
  </span>
)}

const LogsTable = (props) => {
  function openLog(index){
    browser.runtime.sendMessage({
        url: `https://${getParam('host')}/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${evil.logs[index].Id}`,
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


////////////////   INIT //////////////////
var evil = {searchTerm: "", logs: [], loading: true, showMessage: false, message: "", sf : {}}

function getParam(s) {
 const url = new URL(location.href)
 return url.searchParams.get(s)
}

function init(){
  evil.sf = new SF(getParam("host"), getParam("sid"))
  refresh()
  evil.sf.isLogging().then((isLogging)=>{
    evil.isLogging = isLogging
    render()
  })
}

init()


////////////////   END OF INIT //////////////////

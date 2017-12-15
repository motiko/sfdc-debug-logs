import React from 'react'
import {connect} from 'react-redux'
import BackIcon from  'material-ui-icons/Close'
import IconButton from 'material-ui/IconButton'
import List, {ListItem, ListItemText} from 'material-ui/List'
import {getLogBody} from './actions'

class LogViewRaw extends React.Component{
  constructor(props){
    super(props)
  }

  componentWillMount(){
    this.props.fetchBody(this.props.match.params.id)
  }

  logBodyById(id){
    if(!this.props.logs[id]) return ""
    return this.props.logs[id].body
  }

  render(){
    const props = this.props
    return (
      <div style={{display: "block"}}>
      <div style={{width: "20%", height: "100%", position: "fixed", overflowY:"auto" }}>
        <List>
          <ListItem>
           <ListItemText primary="Hello" secondary="{secondaryText(m)}"/>
          </ListItem>
         <ListItem>
           <ListItemText primary="Hello" secondary="{secondaryText(m)}"/>
         </ListItem>
        </List>
      </div>
      <div style={{marginLeft:"30%", overflowY: "auto", height: "80%", width: "100%"}}>
        <IconButton  tooltip="Close" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <div>
          <p style={{whiteSpace: "pre-line", overflowY: "auto"}}>
            {this.logBodyById(props.match.params.id)}
          </p>
        </div>
      </div>
      </div>
    )}
}

const mapStateToProps = (state) => ({logs: state.logs.logs})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: ((logId) => dispatch(getLogBody(logId)))
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

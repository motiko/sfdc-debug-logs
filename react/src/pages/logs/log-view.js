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
    return this.props.logs[id] ? this.props.logs[id]['body'] : ''
  }

  render(){
    const props = this.props
    return (
      <div>
        <IconButton  tooltip="Close" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <div>
          <p style={{whiteSpace: "pre-line"}}>
            {this.logBodyById(props.match.params.id)}
          </p>
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

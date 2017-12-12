import React from 'react'
import BackIcon from  'material-ui-icons/Close'
import IconButton from 'material-ui/IconButton'
import List, {ListItem, ListItemText} from 'material-ui/List'

export default class LogView extends React.Component{
  constructor(props){
    super(props)
    this.state = {body:"", loading:true}
  }

  componentWillMount(){
    this.props.fetchBody(this.props.match.params.id)
      .then(body=>this.setState({body}))
  }

  render(){
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
            {this.state.body}
          </p>
        </div>
      </div>
      </div>
    )}
}

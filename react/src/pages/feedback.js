import React from 'react'
import {List, ListItem} from 'material-ui/List'
import FlatButton from 'material-ui/FlatButton'
import BackIcon from  'material-ui/svg-icons/navigation/arrow-back'
import IconButton from 'material-ui/IconButton'
import MessageIcon from 'material-ui/svg-icons/communication/message'
import MessageEdit from '../components/message-edit'
import MessageView from '../components/message-view'
import Dialog from 'material-ui/Dialog'
import {Toolbar, ToolbarGroup, ToolbarTitle} from 'material-ui/Toolbar'

const BASE_URL = "https://adbg.herokuapp.com"

export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {dialogOpen: true, replyTo: null, messagesSent: 0, messages: []}
    this.sendMessage = this.sendMessage.bind(this)
    this.loadMessages = this.loadMessages.bind(this)
  }

  componentWillMount(){
    this.loadMessages()
  }

  loadMessages(){
    return fetch(`${BASE_URL}/messages`)
      .then(r=>r.json())
      .then(messages => messages.reverse())
      .then((messages)=> this.setState({messages}))
  }

  sendMessage(msg){
    const headers = {"Content-Type": "application/json"}
    const options = {method: 'POST',
                    body: JSON.stringify(msg),
                    headers: headers}
    if(this.state.replyTo){
      fetch(`${BASE_URL}/messages/${this.state.replyTo}/reply`, options)
        .then(this.loadMessages)
    }else{
      fetch(`${BASE_URL}/messages`, options).then(this.loadMessages)
    }
    this.setState((oldState)=>({
        messagesSent: oldState.messagesSent + 1,
        dialogOpen: false,
        replyTo: null
    }))
  }

  handleReply(msg){
    this.setState({dialogOpen: true, replyTo: msg._id})
  }

  openDialog(){
    this.setState({dialogOpen:true})
  }

  closeDialog(){
    this.setState({dialogOpen:false})
  }

  render() {
  return(<div>
    <Toolbar>
      <ToolbarGroup firstChild={true}>
        <IconButton style={{float:"left"}} tooltip="Back" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <FlatButton label="New Message" onClick={()=>this.openDialog()} icon={<MessageIcon/>} />
      </ToolbarGroup>
    </Toolbar>
    <div style={{height: "90%", overflowY:"auto" }}>
      <List style={{width:"70%", margin:"0 auto"}}>
        {this.state.messages.map((m, i)=> (
          <MessageView nested={false} message={m}
              onReply={() => this.handleReply(m)} key={i}/>))}
      </List>
      <Dialog
          modal={false}
          open={this.state.dialogOpen}
          onRequestClose={()=>this.closeDialog()}>
      <MessageEdit onSubmit={this.sendMessage}/>
      </Dialog>
      </div>
  </div>)
  }
}

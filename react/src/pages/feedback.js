import React from 'react'
// import {List, ListItem} from 'material-ui/List'
import List, { ListItem, ListItemText } from 'material-ui/List'
import Button from 'material-ui/Button'
import BackIcon from  'material-ui-icons/ArrowBack'
import IconButton from 'material-ui/IconButton'
import MessageIcon from 'material-ui-icons/Message'
import MessageEdit from '../components/message-edit'
import MessageView from '../components/message-view'
import Dialog,{
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
}  from 'material-ui/Dialog'
import Toolbar from 'material-ui/Toolbar'
import ReplyIcon from 'material-ui-icons/Reply'

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
      fetch(`${BASE_URL}/messages/${this.state.replyTo._id}/reply`, options)
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
    this.setState({dialogOpen: true, replyTo: msg})
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
      <IconButton style={{float:"left"}} tooltip="Back" onClick={()=>window.history.back()}><BackIcon/></IconButton>
      <Button onClick={()=>this.openDialog()} >
        <MessageIcon/>New Message
      </Button>
    </Toolbar>
    <div style={{height: "90%", overflowY:"auto" }}>
      <List style={{width:"70%", margin:"0 auto"}}>
        {this.state.messages.map((m, i)=> (
          <MessageView nested={false} message={m}
              onReply={() => this.handleReply(m)} key={i}/>))}
      </List>
      <Dialog
          fullWidth
          open={this.state.dialogOpen}
          onRequestClose={()=>this.closeDialog()}>
          <DialogTitle>{this.state.replyTo ? `Reply to ${this.state.replyTo.author}` :`New Message`}</DialogTitle>
          <DialogContent>
          <DialogContentText>
            {this.state.replyTo ?
              `Please keep it professional`
              :`Please share any ideas you have, or tell us about bugs you've encountered.`}

          </DialogContentText>
            <MessageEdit onSubmit={this.sendMessage}/>
            <DialogActions>
              <Button  onClick={this.handleSubmit} >
                <ReplyIcon /> Send
              </Button>
            </DialogActions>
          </DialogContent>
      </Dialog>
      </div>
  </div>)
  }
}

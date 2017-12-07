import React from 'react'
import List, { ListItem, ListItemText } from 'material-ui/List'
import Button from 'material-ui/Button'
import BackIcon from  'material-ui-icons/ArrowBack'
import IconButton from 'material-ui/IconButton'
import MessageIcon from 'material-ui-icons/Message'
import MessageEdit from './message-edit'
import MessageView from './message-view'
import Dialog,{
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
}  from 'material-ui/Dialog'
import Toolbar from 'material-ui/Toolbar'
import AppBar from 'material-ui/AppBar'
import ReplyIcon from 'material-ui-icons/Reply'
import Grid from 'material-ui/Grid'
import { createStore, applyMiddleware } from 'redux'
import feedback from './reducers'
import {toggleDialog, replyTo, sendMessage} from './actions'
import {logger, messenger} from './middleware'

const BASE_URL = "https://adbg.herokuapp.com"

let store = createStore(feedback, applyMiddleware(logger, messenger))

export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {messagesSent: 0, messages: []}
    const initDialogState = store.getState().dialogState
    this.state = {...this.state, ...initDialogState}
    this.unsubscribe = store.subscribe(() =>
      this.setState(store.getState().dialogState)
    )
    this.sendMessage = this.sendMessage.bind(this)
    this.loadMessages = this.loadMessages.bind(this)
  }

  componentWillMount(){
    this.loadMessages()
  }

  componentWillUnmount(){
    this.unsubscribe()
  }

  loadMessages(){
    return fetch(`${BASE_URL}/messages`)
      .then(r=>r.json())
      .then(messages => messages.reverse())
      .then((messages)=> this.setState({messages}))
  }

  sendMessage(msg){
    debugger
    store.dispatch(sendMessage(msg))
    // const headers = {"Content-Type": "application/json"}
    // const options = {method: 'POST',
    //                 body: JSON.stringify(msg),
    //                 headers: headers}
    // if(this.state.replyTo){
    //   fetch(`${BASE_URL}/messages/${this.state.replyTo._id}/reply`, options)
    //     .then(this.loadMessages)
    // }else{
    //   fetch(`${BASE_URL}/messages`, options).then(this.loadMessages)
    // }
    // this.setState((oldState)=>({
    //     messagesSent: oldState.messagesSent + 1,
    //     dialogOpen: false,
    //     replyTo: null
    // }))
  }

  handleReply(msg){
    store.dispatch(toggleDialog())
    store.dispatch(replyTo(msg))
  }

  openDialog(){
    store.dispatch(toggleDialog())
  }

  closeDialog(){
    store.dispatch(toggleDialog())
  }

  render() {
  return(<div style={{ paddingTop: 80 }}>
    <AppBar position="fixed">
      <Toolbar>
        <IconButton tooltip="Back" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <Button color="contrast" onClick={()=>this.openDialog()} >
          <MessageIcon/>New Message
        </Button>
      </Toolbar>
    </AppBar>

      <List style={{width: "60%", margin:"auto"}}>
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
              <Button  color="primary" onClick={this.handleSubmit} >
                <ReplyIcon /> Send
              </Button>
            </DialogActions>
          </DialogContent>
      </Dialog>

  </div>)
  }
}

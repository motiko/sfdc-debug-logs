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
import {toggleDialog, setReplyTo, sendMessage, loadMessages} from './actions'
import thunk from 'redux-thunk'

const BASE_URL = "https://adbg.herokuapp.com"

let store = createStore(feedback, applyMiddleware(thunk))

export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = store.getState()
    this.unsubscribe = store.subscribe(() =>
      this.setState(store.getState())
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
    store.dispatch(loadMessages())
  }

  sendMessage(msg){
    store.dispatch(sendMessage(msg, this.state.replyTo ? this.state.replyTo._id : null))
  }

  handleReply(msg){
    store.dispatch(toggleDialog())
    store.dispatch(setReplyTo(msg))
  }

  handleSubmit(){

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
          </DialogContent>
      </Dialog>

  </div>)
  }
}

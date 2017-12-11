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
import feedback from '../../reducers'
import {toggleDialog, setReplyTo, sendMessage, loadMessages} from '../../actions'
import { connect } from 'react-redux'

const BASE_URL = "https://adbg.herokuapp.com"

const mapStateToProps = (state) =>{
  return state
}

const mapDispatchToProps = (dispatch) => ({
  loadMessages: () => {
    dispatch(loadMessages())
  },

  sendMessage: (msg, replyTo) => {
    dispatch(sendMessage(msg, replyTo ? replyTo._id : null))
  },

  handleReply: (msg) => {
    dispatch(toggleDialog())
    dispatch(setReplyTo(msg))
  },

  toggleDialog: () => {
    dispatch(toggleDialog())
  }
})

function FeedbackPageComponent(props){
  return(<div style={{ paddingTop: 80 }}>
    <AppBar position="fixed">
      <Toolbar>
        <IconButton tooltip="Back" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <Button color="contrast" onClick={()=>props.toggleDialog()} >
          <MessageIcon/>New Message
        </Button>
      </Toolbar>
    </AppBar>

      <List style={{width: "60%", margin:"auto"}}>
        {props.messages.map((m, i)=> (
          <MessageView nested={false} message={m}
              onReply={() => props.handleReply(m)} key={i}/>))}
      </List>

      <Dialog
          fullWidth
          open={props.dialogOpen}
          onRequestClose={()=>props.toggleDialog()}>
          <DialogTitle>{props.replyTo ? `Reply to ${props.replyTo.author}` :`New Message`}</DialogTitle>
          <DialogContent>
          <DialogContentText>
            {props.replyTo ?
              `Please keep it professional`
              :`Please share any ideas you have, or tell us about bugs you've encountered.`}

          </DialogContentText>
            <MessageEdit onSubmit={(msg) => props.sendMessage(msg, props.replyTo)}/>
          </DialogContent>
      </Dialog>

  </div>)
}

const FeedbackPage = connect(mapStateToProps, mapDispatchToProps)(FeedbackPageComponent)

export default FeedbackPage

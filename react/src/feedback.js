import React from 'react'
import {List, ListItem} from 'material-ui/List';
import Divider from 'material-ui/Divider';
import Subheader from 'material-ui/Subheader';
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import TextField from 'material-ui/TextField';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton'
import TextSmsIcon from 'material-ui/svg-icons/content/send'
import ReplyIcon from 'material-ui/svg-icons/content/reply'
import BackIcon from  'material-ui/svg-icons/navigation/arrow-back'
import IconButton from 'material-ui/IconButton'
import MessageIcon from 'material-ui/svg-icons/communication/message'

const BASE_URL = "https://adbg.herokuapp.com"

export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {dialogOpen: false, replyTo: null, messagesSent: 0, messages: []}
    this.handlePost = this.handlePost.bind(this)
    this.loadMessages = this.loadMessages.bind(this)
  }

  componentWillMount(){
    this.loadMessages()
  }

  loadMessages(){
    return fetch(`${BASE_URL}/messages`)
      .then(r=>r.json())
      .then((messages)=> this.setState({messages}))
  }

  handlePost(msg){
    console.log("SENDING...")
    console.log(msg)
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
    console.log(msg)
    this.setState({dialogOpen: true, replyTo: msg._id})
  }

  openDialog(){
    this.setState({dialogOpen:true})
  }

  closeDialog(){
    this.setState({dialogOpen:false})
  }

  render() {
    return(
    <div style={{width:"80%", margin:"0 auto"}}>
      <div style={{textAlign: "center", marginBottom: 15}}>
        <IconButton style={{float:"left"}} tooltip="Back" onClick={()=>window.history.back()}><BackIcon/></IconButton>
        <FlatButton style={{margin:"0px auto", width: 250}} label="New Message" onClick={()=>this.openDialog()} icon={<MessageIcon/>} />
      </div>
      <List>

        {this.state.messages.map((m, i)=> (
          <ViewMessage nested={false} message={m}
              onReply={() => this.handleReply(m)} key={i}/>))}
      </List>
      <MessageDialog open={this.state.dialogOpen} onSubmit={this.handlePost} onClose={()=>this.closeDialog()}/>
    </div>)
  }
}

function ViewMessage(props){
  const m = props.message
  const bodyLines = m.body.split('\n')
  const secondaryText = bodyLines.length > 1
                         ? (<p> {bodyLines[1]} <br/> Sent By: {m.author}</p>)
                         : `Sent By: ${m.author}`
  const replyButton =  (<IconButton tooltip="Reply" onClick={props.onReply}><ReplyIcon/></IconButton>)
  if(props.nested){
    return (<ListItem primaryText={bodyLines[0]}
        secondaryTextLines={2}
        secondaryText={secondaryText} disabled={true} key={props.key}/>)
  }else{
    return (
      <ListItem primaryText={bodyLines[0]} secondaryText={secondaryText}
                disabled={true}
                secondaryTextLines={2}
                rightIconButton={replyButton}
                open={true}
                nestedItems={m.replies ?
                m.replies.map((m,i) => ViewMessage({nested:true, message:m, key:i})) : []}/>)
  }
}

class MessageDialog extends React.Component{
  constructor(props){
    super(props)
    this.state = {name: "", body: "", error: ""}
  }

  handleNameChange(e){
    this.setState({name: e.target.value})
  }

  handleBodyChange(e){
    const newBody = e.target.value
    const newLines = newBody.match(/\n/g)
    if(newLines && newLines.length > 1) return
    if(newBody.length > 140) return
    this.setState({body : newBody})
  }

  handleSubmit(){
    if(this.state.body.trim() == "" || this.state.body.length < 5){
      this.setState({error:"This field is required (at least 5 characters)"})
      return
    }
    const msg = {
      body: this.state.body,
      author: this.state.name
    }
    this.props.onSubmit(msg)
    this.setState({name: "", body: ""})
  }

  handleKeyUp(e){
    if(e.keyCode == 13){
      console.log(e)
      if(e.altKey || e.shiftKey || e.ctrlKey) this.handleSubmit()
    }
  }

  render(){
    return (
      <Dialog
          actions={[<FlatButton label="Send" onClick={()=>this.handleSubmit()} icon={<ReplyIcon />} /> ]}
          modal={false}
          open={this.props.open}
          onRequestClose={this.props.onClose}>
        <TextField
          floatingLabelText="Name (Optional)"
          value={this.state.name}
          onChange={(e) => this.handleNameChange(e)}
        />
        <TextField
          floatingLabelText={`Any thoughts (${this.state.body.length}/140)`}
          value={this.state.body}
          onChange={(e) => this.handleBodyChange(e)}
          multiLine={true}
          rowsMax={2}
          style={{width:650}}
          onKeyUp={(e)=>this.handleKeyUp(e)}
          errorText={this.state.error}
        />
    </Dialog>)
  }
}

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
import IconButton from 'material-ui/IconButton'

const evilMessages = [
  {
    "_id": "5a1796db3e0d4f0208d224e7",
    "body": `"Do you think you can tell
    Heaven from hel Blue sky from the groung above"`,
    "author": "pink",
    "createdAt": 1511495387263,
    "replies": [
      {
        "body": `"Which one is pink by the way.Or what is going on anyway"`,
        "author": "manager",
        "createdAt": 1511495410511
      }
    ]
  }
]

const style={width:650, margin: "0 auto"}

function nestedMessage(m,i){
  return (
    <ListItem primaryText={m.body}
        secondaryTextLines={2}
        secondaryText={`Sent By: ${m.author}`} key={i}/>)
}


export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {dialogOpen: false, replyTo: null, messagesSent: 0, messages: evilMessages}
    this.handlePost = this.handlePost.bind(this)
  }

  handlePost(msg){
    console.log("SENDING...")
    console.log(msg)
    this.setState((oldState)=>({
        messagesSent: oldState.messagesSent + 1,
        dialogOpen: false,
        replyTo: null,
        messages: [...oldState.messages,msg]
    }))
  }

  handleReply(msg){
    console.log(msg)
    this.setState({dialogOpen: true, replyTo: msg._id})
  }

  render() {
    return(
    <div>
      <List>
        <Subheader style={{textAlign: "center"}}>Latest Messages</Subheader>
        {this.state.messages.map((m, i)=> (
          <ViewMessage nested={false} message={m}
              onReply={() => this.handleReply(m)} key={i}/>))}
      </List>
      <MessageDialog open={this.state.dialogOpen} onSubmit={this.handlePost}/>
    </div>)
  }
}

function ViewMessage(props){
  const m = props.message
  const bodyLines = m.body.split('\n')
  const secondaryText = bodyLines.length > 1
                         ? (<p> {bodyLines[1]} <br/> SentBy: {m.author}</p>)
                         : `By: ${m.author}`
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
    this.state = {name: "", body: ""}
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
    const msg = {
      body: this.state.body,
      author: this.state.name
    }
    this.props.onSubmit(msg)
  }


  render(){
    return (
      <Dialog
          actions={[<FlatButton label="Send" onClick={()=>this.handleSubmit()} icon={<ReplyIcon />} /> ]}
          modal={true}
          open={this.props.open}
          onRequestClose={this.handleClose}>
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
          style={{width:650}}
        />
    </Dialog>)
  }
}

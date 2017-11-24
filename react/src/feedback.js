import React from 'react'
import {List, ListItem} from 'material-ui/List';
import Divider from 'material-ui/Divider';
import Subheader from 'material-ui/Subheader';
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import TextField from 'material-ui/TextField';
import Dialog from 'material-ui/Dialog';

import TextSmsIcon from 'material-ui/svg-icons/content/send'
import ReplyIcon from 'material-ui/svg-icons/content/reply'
import IconButton from 'material-ui/IconButton'

const messages = [
  {
    "_id": "5a1796db3e0d4f0208d224e7",
    "body": "Do you think you can tell",
    "author": "pink",
    "createdAt": 1511495387263,
    "replies": [
      {
        "body": "Which one is pink by the way",
        "author": "manager",
        "createdAt": 1511495410511
      }
    ]
  }
]

const style={width:650, margin: "0 auto"}

function nestedMessage(m,i){
  return (
    <ListItem primaryText={`By: ${m.author}`}
        secondaryTextLines={2}
        secondaryText={m.body} key={i}/>)
}


export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {dialogOpen: false, replyTo: null, messagesSent: 0}
    this.handlePost = this.handlePost.bind(this)
  }

  handlePost(msg){
    consloe.log("SENDING...")
    consloe.log(msg)
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

  render() {
    return(
    <div>
      <List>
        <Subheader style={{textAlign: "center"}}>Latest Messages</Subheader>
        {messages.map((m, i)=> (
          <ListItem primaryText={`By: ${m.author}`} secondaryText={m.body} key={i}
              secondaryTextLines={2} rightIconButton={<IconButton tooltip="Reply" onClick={()=>this.handleReply(m)} >
              <ReplyIcon/></IconButton>}
              open={true} nestedItems={m.replies ? m.replies.map(nestedMessage) : []}/>
        ))}
      </List>
      <MessageDialog open={this.state.dialogOpen} onSubmit={this.handlePost}/>
    </div>)
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
    this.setState({body : e.target.value})
  }


  render(){
    return (
      <Dialog title="Give Feedback"
          actions={[]}
          modal={false}
          open={this.props.open}>
        <TextField
          floatingLabelText="Name (Optional)"
          style={{bottom:105, position:"absolute"}}
          value={this.state.name}
          onChange={(e) => this.handleNameChange(e)}
        />
        <TextField
          floatingLabelText="Any feedback is apprectiated"
          multiLine={true}
          style={{bottom:11, position:"absolute"}}
          value={this.state.body}
          onChange={(e) => this.handleBodyChange(e)}
          style={{width:650}}
        />
    </Dialog>)
  }
}

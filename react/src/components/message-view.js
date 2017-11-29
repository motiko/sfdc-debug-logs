import React from 'react'
import List, {ListItem, ListItemText, ListItemIcon} from 'material-ui/List'
import IconButton from 'material-ui/IconButton'
import ReplyIcon from 'material-ui-icons/Reply'

export default function MessageView({message: m, onReply, nested}){
  function repliesList(replies){
    if(!replies) return;
    return (<List disablePadding>
      {replies.map((m,i) => <ListItem key={i}> <ListItemText inset primary={m.body}
          secondary={secondaryText(m)} disabled={true}/></ListItem>)}
    </List>
    )
  }

  function secondaryText(msg){
    return (msg.author.trim() == "") ? "Sent By: Anonymous" : `Sent By: ${msg.author}`
  }
  return (<div>
    <ListItem button onClick={onReply}>
     <ListItemText primary={m.body} secondary={secondaryText(m)}/>
    <ListItemIcon>
      <ReplyIcon/>
    </ListItemIcon>
    </ListItem>
    {repliesList(m.replies)}
  </div>)
}


/*

rightIconButton={replyButton}
nestedItems={m.replies ?
m.replies.map((m,i) => MessageView({nested:true, message:m, key:i})) : []}
*/

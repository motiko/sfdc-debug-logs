import React from 'react'
import {List, ListItem} from 'material-ui/List'
import IconButton from 'material-ui/IconButton'
import ReplyIcon from 'material-ui/svg-icons/content/reply'

export default function MessageView(props){
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
                m.replies.map((m,i) => MessageView({nested:true, message:m, key:i})) : []}/>)
  }
}

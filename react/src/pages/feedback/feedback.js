import React from 'react'
import List from 'material-ui/List'
import Button from 'material-ui/Button'
import BackIcon from 'material-ui-icons/ArrowBack'
import IconButton from 'material-ui/IconButton'
import MessageIcon from 'material-ui-icons/Message'
import MessageEdit from './message-edit'
import MessageView from './message-view'
import Dialog, {
  DialogContent,
  DialogContentText,
  DialogTitle
} from 'material-ui/Dialog'
import Toolbar from 'material-ui/Toolbar'
import AppBar from 'material-ui/AppBar'
import { connect } from 'react-redux'
import { toggleDialog, setReplyTo, sendMessage, loadMessages } from './actions'

const mapStateToProps = state => {
  return state.feedbackPage
}

const mapDispatchToProps = dispatch => ({
  loadMessages: () => {
    dispatch(loadMessages())
  },
  sendMessage: (msg, replyTo) => {
    dispatch(sendMessage(msg, replyTo ? replyTo._id : null))
  },
  handleReply: msg => {
    dispatch(toggleDialog())
    dispatch(setReplyTo(msg))
  },
  toggleDialog: () => {
    dispatch(toggleDialog())
  }
})

class FeedbackPageComponent extends React.Component {
  componentDidMount() {
    this.props.loadMessages()
  }

  render() {
    return (
      <div style={{ paddingTop: 80 }}>
        <AppBar position="fixed">
          <Toolbar>
            <IconButton tooltip="Back" onClick={() => window.history.back()}>
              <BackIcon />
            </IconButton>
            <Button color="contrast" onClick={() => this.props.toggleDialog()}>
              <MessageIcon />
              New Message
            </Button>
          </Toolbar>
        </AppBar>
        <List
          style={{
            width: '60%',
            margin: 'auto'
          }}
        >
          {this.props.messages.map((m, i) => (
            <MessageView
              nested={false}
              message={m}
              onReply={() => this.props.handleReply(m)}
              key={i}
            />
          ))}
        </List>
        <Dialog
          fullWidth
          open={this.props.dialogOpen}
          onClose={() => this.props.toggleDialog()}
        >
          <DialogTitle>
            {this.props.replyTo
              ? `Reply to ${this.props.replyTo.author}`
              : `New Message`}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {this.props.replyTo
                ? `Please keep it professional`
                : `Please share any ideas you have, or tell us about bugs you've encountered.`}
            </DialogContentText>
            <MessageEdit
              onSubmit={msg => this.props.sendMessage(msg, this.props.replyTo)}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }
}

const FeedbackPage = connect(
  mapStateToProps,
  mapDispatchToProps
)(FeedbackPageComponent)

export default FeedbackPage

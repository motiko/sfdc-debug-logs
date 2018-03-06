import React from "react"
import ReplyIcon from "material-ui-icons/Reply"
import Button from "material-ui/Button"
import TextField from "material-ui/TextField"
import { DialogActions } from "material-ui/Dialog"

export default class MessageEdit extends React.Component {
  constructor(props) {
    super(props)
    this.state = { name: "", body: "", error: "" }
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleNameChange(e) {
    this.setState({ name: e.target.value })
  }

  componentDidMount() {
    if (this.nameElement) {
      this.nameElement.focus()
    }
  }

  componentWillMount() {
    this.setState({ name: "", body: "", error: "" })
  }

  handleBodyChange(e) {
    const newBody = e.target.value
    const newLines = newBody.match(/\n/g)
    if (newLines && newLines.length > 1) return
    if (newBody.length > 140) return
    this.setState({ body: newBody })
  }

  handleSubmit() {
    if (this.state.body.trim() === "" || this.state.body.length < 5) {
      this.setState({
        error: "This field is required (at least 5 characters)"
      })
      return
    }
    const msg = {
      body: this.state.body,
      author: this.state.name
    }
    this.props.onSubmit(msg)
  }

  handleKeyDown(e) {
    if (e.keyCode === 13) {
      if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) this.handleSubmit()
    }
  }

  render() {
    return (
      <div>
        <TextField
          label="Name (Optional)"
          value={this.state.name}
          onChange={e => this.handleNameChange(e)}
          inputRef={element => {
            this.nameElement = element
          }}
        />
        <TextField
          label={`Any thoughts (${this.state.body.length}/140)`}
          value={this.state.body}
          onChange={e => this.handleBodyChange(e)}
          multiline
          fullWidth
          rowsMax="2"
          onKeyDown={e => this.handleKeyDown(e)}
          error={this.state.error.length > 0}
          helperText={this.state.error}
        />
        <DialogActions>
          <Button color="primary" onClick={this.handleSubmit}>
            <ReplyIcon /> Send
          </Button>
        </DialogActions>
      </div>
    )
  }
}

import React from 'react'
import {connect} from 'react-redux'
import BackIcon from 'material-ui-icons/Close'
import IconButton from 'material-ui/IconButton'
import Grid from 'material-ui/Grid'
import {getLogBody} from './actions'

class LogViewRaw extends React.Component {
  componentWillMount () {
    this.props.fetchBody(this.props.match.params.id)
  }

  componentDidMount () {
    this.highlight()
  }

  componentDidUpdate () {
    this.highlight()
  }

  highlight () {
    if (window.Prism) window.Prism.highlightElement(this.preElement)
  }

  logBodyById (id) {
    return this.props.logs[id] ? this.props.logs[id]['body'] : ''
  }

  render () {
    const props = this.props
    return (
      <Grid container='container' direction='column' justify='flex-start'>
        <IconButton tooltip='Close' onClick={() => window.history.back()}><BackIcon /></IconButton>
        <pre style={{overflowY: 'auto', height: '80%', whiteSpace: 'pre-line'}} className='language-json' ref={element => { this.preElement = element }}>
          <code>
            {this.logBodyById(props.match.params.id)}
          </code>
        </pre>
      </Grid>
    )
  }
}

const mapStateToProps = (state) => ({logs: state.logs.logs})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: (logId) => dispatch(getLogBody(logId))
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

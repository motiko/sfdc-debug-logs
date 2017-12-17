import React from 'react'
import {connect} from 'react-redux'
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

  displayLogBody (id) {
    return this.props.logs[id] ? this.props.logs[id]['body'] : ''
  }

  render () {
    const props = this.props
    return (
      <Grid container='container' direction='column' justify='flex-start'>
        <pre style={{ whiteSpace: 'pre-wrap' }} className='language-apexlog' ref={element => { this.preElement = element }}>
          <code>
            {this.displayLogBody(props.match.params.id)}
          </code>
        </pre>
      </Grid>)
  }
}

const mapStateToProps = (state) => ({logs: state.logs.logs})

const mapDispatchToProps = (dispatch) => ({
  fetchBody: (logId) => dispatch(getLogBody(logId))
})

const LogView = connect(mapStateToProps, mapDispatchToProps)(LogViewRaw)

export default LogView

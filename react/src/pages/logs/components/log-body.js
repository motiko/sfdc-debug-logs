import React from 'react'
import { parseLog, addExpansionButtons } from '../parse-log'
import { maxLogSizeToParse } from '../constants'

const preStyle = {
  whiteSpace: 'pre-wrap',
  fontSize: 17,
  lineHeight: '140%',
  fontFamily: "'Courier New', 'Courier', mono",
  marginLeft: '20px',
  overflowWrap: 'break-word'
}

export default class LogBody extends React.Component {
  componentDidUpdate(oldProps) {
    const body = this.props.body
    if (
      this.props.body &&
      this.props.body.length > 0 &&
      body != oldProps.body
    ) {
      addExpansionButtons()
    }
  }

  componentDidMount() {
    addExpansionButtons()
  }

  render() {
    const body = this.props.body
    if (body.length > maxLogSizeToParse) {
      return <pre style={preStyle}>{body}</pre>
    }
    return <pre style={preStyle} dangerouslySetInnerHTML={parseLog(body)} />
  }
}

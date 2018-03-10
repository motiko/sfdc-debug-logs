import React from 'react'
import { ParsedLog, addExpansionButtons } from './parsed-log'
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
  render() {
    const body = this.props.body
    return (
      <pre style={preStyle}>
        <ParsedLog body={body} />
      </pre>
    )
  }
}

import React from 'react'
import { parseLog, addExpansionButtons } from '../parse-log'

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
    return (
      <pre
        style={{ paddingLeft: '25px' }}
        dangerouslySetInnerHTML={parseLog(body)}
      />
    )
  }
}

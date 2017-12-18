import React from 'react'

export default class LogBody extends React.Component {
  componentDidMount () {
    if (this.props.body && this.props.body.length > 0) {
      window.Prism.highlightAll()
    }
  }

  componentDidUpdate (prevProps, prevState) {
    if (this.props.body && this.props.body.length > 0) {
      window.Prism.highlightAll()
    }
  }

  render () {
    return (<pre className='language-apexlog' style={{ paddingLeft: '25px'}}>
      <code style={{ whiteSpace: 'pre-wrap', overflowY: 'scroll'}}>
        {this.props.body}
      </code>
    </pre>)
  }
}

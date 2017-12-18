import React from 'react'

export default class LogBody extends React.Component {
  componentDidMount () {
    if (this.props.body && this.props.body.length > 0) {
      console.log('highlight in mount')
      window.Prism.highlightAll()
    }
  }

  componentDidUpdate (prevProps, prevState) {
    if (this.props.body && this.props.body.length > 0) {
      console.log('highlight update')
      window.Prism.highlightAll()
    }
  }

  render () {
    return (<pre className='language-apexlog' >
      <code style={{ whiteSpace: 'pre-wrap', overflowY: 'scroll' }}>
        {this.props.body}
      </code>
    </pre>)
  }
}

import React from 'react'

export default class LogBody extends React.PureComponent {
  componentDidMount () {
    this.highlight()
  }

  componentDidUpdate (prevProps, prevState) {
    this.highlight()
  }

  highlight () {
    console.info('highlight')
    if (window.Prism) window.Prism.highlightElement(this.preElement)
  }

  render () {
    return (<pre style={{ whiteSpace: 'pre-wrap' }} className='language-apexlog' ref={element => { this.preElement = element }}>
      <code>
        {this.props.body}
      </code>
    </pre>)
  }
}

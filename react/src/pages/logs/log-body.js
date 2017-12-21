import React from 'react'

export default class LogBody extends React.Component {
  componentDidMount () {
    this.highlight()
  }

  componentDidUpdate (prevProps, prevState) {
    console.log('upd')
    this.highlight()
  }

  highlight () {
    if (this.props.body && this.props.body.length > 0) {
      console.log('high')
      window.Prism.highlightAll()
    }
  }

  render () {
    const body = this.props.body
    return (<div>
      {body.map((chunk, index) => {
        return (<pre key={index} className='language-apexlog' style={{ paddingLeft: '25px' }}>
          <code style={{ whiteSpace: 'pre-wrap', overflowY: 'scroll' }}>
            {chunk}
          </code>
        </pre>)
      })}
    </div>)
  }
}

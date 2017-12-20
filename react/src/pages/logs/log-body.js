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
    if (this.props.body && this.props.body.length > 0){
      console.log('high')
      window.Prism.highlightAll()
    }
  }

  render () {
    const body = this.props.body
    if(body && body.length > 0){
      if (body.length < 500 * 1000) {
        return (<pre className='language-apexlog' style={{ paddingLeft: '25px' }}>
          <code style={{ whiteSpace: 'pre-wrap', overflowY: 'scroll' }}>
            {this.props.body}
          </code>
        </pre>)
      }else{
        const bodyLines = body.split("\n")
        const numOfLines = bodyLines.length
        const chunkOfLines = bodyLines.reduce((acc, curLine) => {
            if(acc[acc.length-1].length < 500){
              acc[acc.length-1].push(curLine)
              return acc
            }else{
              acc.push([curLine])
              return acc
            }
        },[[]])
        return (<div>
          {
            chunkOfLines.map(chunk => chunk.join('\n')).map((chunk,index) => {
              return (<pre key={index} className='language-apexlog' style={{ paddingLeft: '25px' }}>
                <code style={{ whiteSpace: 'pre-wrap', overflowY: 'scroll' }}>
                  {chunk}
                </code>
              </pre>)
            })
          }
        </div>)
      }
    }
    return null
  }
}

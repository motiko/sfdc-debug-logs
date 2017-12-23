import React from 'react'
import {parseLog, addExpansionButtons} from './parse-log'
export default class LogBody extends React.Component {

  // componentDidMount () {
  //   this.highlight()
  // }
  //
  // componentDidUpdate (prevProps, prevState) {
  //   console.log('upd')
  //   this.highlight()
  // }
  //
  // highlight () {
  //   if (this.props.body && this.props.body.length > 0) {
  //     console.log('high')
  //     window.Prism.highlightAll()
  //   }
  // }

  // componentDidMount(){
  //   if(this.props.body && this.props.body.length > 0)
  //     addExpansionButtons()
  // }

  componentDidUpdate(oldProps){
    const body = this.props.body
    if(this.props.body && this.props.body.length > 0 && body != oldProps.body)
      addExpansionButtons()
  }

  render () {
    const body = this.props.body
    return (
      <pre style={{ paddingLeft: '25px' }} dangerouslySetInnerHTML={parseLog(body)}>
      </pre>)
  }
}

import React from 'react'

export default class LogView extends React.Component{
  constructor(props){
    super(props)
    this.state = {body:"", loading:true}
  }

  componentWillMount(){
    this.props.fetchBody(this.props.match.params.id)
      .then(body=>this.setState({body}))
  }

  render(){
    return (
      <p>
        {this.state.body}
      </p>
    )}
}

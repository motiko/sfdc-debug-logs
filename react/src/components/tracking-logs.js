import React from 'react'
import FlatButton from 'material-ui/FlatButton'
import CheckBlankIcon from 'material-ui/svg-icons/toggle/check-box-outline-blank'
import CheckIcon from 'material-ui/svg-icons/toggle/check-box'

export default class TrackingLogs extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isTracking: false
    }
    this.startLogging = this.startLogging.bind(this)
    this.sf = props.sf
  }

  startLogging() {
    this.sf.startLogging().then((res) => {
      if(res && res.success)
        this.setState({isTracking: true})
      else
        this.checkIsLogging()
    })
  }

  checkIsLogging(){
    this.sf.isLogging().then((isTracking)=> this.setState({isTracking}))
  }

  componentDidMount() {
    this.sf.isLogging().then((isTracking) => {
      this.setState({isTracking})
      if (!isTracking)
        this.startLogging()
    })
  }

  render() {
    const style = {
      position: "absolute",
      top: 7,
      left: 10
    }
    if (this.state.isTracking) {
      return <FlatButton label="Logging Activity" disabled={true} style={style} icon={<CheckIcon />}/>
    }
    return (<FlatButton label="Start Logging" onClick={this.startLogging} style={style} icon={<CheckBlankIcon />}/>)
  }
}

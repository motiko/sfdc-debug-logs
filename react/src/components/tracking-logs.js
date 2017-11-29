import React from 'react'
import Button from 'material-ui/Button'
import CheckBlankIcon from 'material-ui-icons/CheckBoxOutlineBlank'
import CheckIcon from 'material-ui-icons/CheckBox'

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
    if (this.state.isTracking) {
      return <Button disabled> <CheckIcon/> Logging Activity </Button>
    }
    return (<Button onClick={this.startLogging} > <CheckBlankIcon/> Start Logging</Button>)
  }
}

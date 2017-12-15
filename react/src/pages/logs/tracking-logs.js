import React from 'react'
import Button from 'material-ui/Button'
import CheckBlankIcon from 'material-ui-icons/CheckBoxOutlineBlank'
import {connect} from 'react-redux'
import CheckIcon from 'material-ui-icons/CheckBox'
import {startLogging, checkIsLogging, checkIsLoggingAndStart} from './actions'


class TrackingLogsComponent extends React.Component {
  constructor(props) {
    super(props)
  }

  componentDidMount() {
    this.props.checkIsLoggingAndStart()
  }

  render() {
    if (this.props.isLogging) {
      return <Button  disabled  > <CheckIcon/> Logging Activity </Button>
    }
    return (<Button onClick={this.props.startLogging} > <CheckBlankIcon/> Start Logging</Button>)
  }
}

const mapStateToProps = (state) => ({isLogging: state.logs.isLogging})

const mapDispatchToProps = (dispatch) => ({
  checkIsLoggingAndStart: (() => dispatch(checkIsLoggingAndStart())),
  checkIsLogging: (() => dispatch(checkIsLogging())),
  startLogging: (() => dispatch(startLogging())),
})

const TrackingLogs = connect(mapStateToProps, mapDispatchToProps)(TrackingLogsComponent)

export default TrackingLogs

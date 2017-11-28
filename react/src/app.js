import 'react-devtools'
import SF from './api/sf'
import React from 'react'
import ReactDOM from 'react-dom'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import FeedbackPage from './pages/feedback'
import LogsPage from './pages/logs'
import {
  HashRouter as Router,
  Route,
  Link,
  hashHistory,
  Redirect,
  Switch
} from 'react-router-dom'

class App extends React.Component {
  constructor(props){
    super(props)
  }

  render() {
    function getParam(s) {
      const url = new URL(location.href)
      return url.searchParams.get(s)
    }
    const sf = new SF(getParam("host"), getParam("sid"))
    return (
      <MuiThemeProvider>
      <Router history={hashHistory}>
        <Switch>
          <Route path="/logs" render={props => <LogsPage sf={sf} {...props}/>} />
          <Route exact path="/feedback" render={props => <FeedbackPage sf={sf} {...props}/>}/>
          <Route render={props => <LogsPage sf={sf} {...props}/>}/>
        </Switch>
      </Router>
      </MuiThemeProvider>)
  }
}

function render() {
  ReactDOM.render(<App/>, document.getElementById("container"))
}

render()

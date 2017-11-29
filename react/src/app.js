// import 'react-devtools'
import SF from './api/sf'
import React from 'react'
import ReactDOM from 'react-dom'
import { MuiThemeProvider, createMuiTheme} from 'material-ui/styles';
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

const theme = createMuiTheme({
  palette: {
    type: 'dark', // Switching the dark mode on is a single property value change.
  }
})

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
      <Router history={hashHistory}>
        <Switch>
          <Route path="/logs" render={props => <LogsPage sf={sf} {...props}/>} />
          <Route exact path="/feedback" render={props => <FeedbackPage sf={sf} {...props}/>}/>
          <Route render={props => <LogsPage sf={sf} {...props}/>}/>
        </Switch>
      </Router>)
  }
}

ReactDOM.render(<App/>, document.getElementById("container"))

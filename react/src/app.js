// import 'react-devtools'
import SF from './api/sf'
import React from 'react'
import ReactDOM from 'react-dom'
import { MuiThemeProvider, createMuiTheme} from 'material-ui/styles';
import FeedbackPage from './pages/feedback/feedback'
import LogsPage from './pages/logs'
import indigo from 'material-ui/colors/indigo';
import teal from 'material-ui/colors/teal';

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
      <Router history={hashHistory}>
        <Switch>
          <Route path="/logs" render={props => <LogsPage sf={sf} {...props}/>} />
          <Route exact path="/feedback" render={props => <FeedbackPage sf={sf} {...props}/>}/>
          <Route render={props => <LogsPage sf={sf} {...props}/>}/>
        </Switch>
      </Router>)
  }
}

const theme = createMuiTheme({
  palette: {
      primary: teal,
      secondary: indigo,
      // type: 'dark'
    }
 })

const ThemedApp = () => (
<MuiThemeProvider theme={theme}>
  <App/>
</MuiThemeProvider>)

ReactDOM.render(<ThemedApp/>, document.getElementById("container"))

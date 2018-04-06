// import 'react-devtools'
import React from 'react'
import ReactDOM from 'react-dom'
import { MuiThemeProvider, createMuiTheme } from 'material-ui/styles'
import indigo from 'material-ui/colors/indigo'
import teal from 'material-ui/colors/teal'
import {
  HashRouter as Router,
  Route,
  hashHistory,
  Switch
} from 'react-router-dom'
import { Provider } from 'react-redux'
import idbKeyval from 'idb-keyval'
import thunk from 'redux-thunk'
import { createStore, applyMiddleware } from 'redux'
import appReducer from './reducers'
import { loadMessages } from './pages/feedback/actions'
import FeedbackPage from './pages/feedback/feedback'
import LogsPage from './pages/logs/logs'
import globalSf from './global-sf'
import './app.css'
import { defaultInnerLogsState } from './pages/logs/reducer'
import { defaultStyleConfig } from './pages/logs/dialogs/style/reducer'

class App extends React.Component {
  componentDidMount() {
    this.props.store.dispatch(loadMessages())
    window.addEventListener('beforeunload', event => {
      const logsPageState = this.props.store.getState().logsPage

      idbKeyval.set(
        'savedSettings',
        [
          'maxLogs',
          'styleConfig',
          'visibleEvents',
          'sideLogsOpen',
          'logBodies'
        ].reduce(
          (acc, curKey) => ({
            ...acc,
            [curKey]: logsPageState[curKey]
          }),
          {}
        )
      )
    })
  }

  render() {
    return (
      <Router history={hashHistory}>
        <Switch>
          <Route path="/logs" render={ownProps => <LogsPage {...ownProps} />} />
          <Route
            exact
            path="/feedback"
            render={ownProps => <FeedbackPage {...ownProps} />}
          />
          <Route render={ownProps => <LogsPage {...ownProps} />} />
        </Switch>
      </Router>
    )
  }
}

const theme = createMuiTheme({
  palette: {
    primary: teal,
    secondary: indigo
    // // type: 'dark'
    // background: {
    //   default: '#d6c2c2',
    //   paper: '#d6c2c2'
    // }
  }
})

idbKeyval.get('savedSettings').then(savedSettings => {
  const loadedLogsPageSettings = {
    maxLogs: savedSettings.maxLogs,
    styleConfig: { ...defaultStyleConfig, ...savedSettings.styleConfig },
    visibleEvents: savedSettings.visibleEvents,
    sideLogsOpen: savedSettings.sideLogsOpen,
    logBodies: savedSettings.logBodies
  }
  const store = createStore(
    appReducer,
    { logsPage: { ...defaultInnerLogsState, ...loadedLogsPageSettings } },
    applyMiddleware(thunk.withExtraArgument(globalSf))
  )

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // window._store = store //
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!1

  const ProvidedApp = () => (
    <MuiThemeProvider theme={theme}>
      <Provider store={store}>
        <App store={store} />
      </Provider>
    </MuiThemeProvider>
  )

  ReactDOM.render(<ProvidedApp />, document.getElementById('container'))
})

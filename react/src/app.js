// import 'react-devtools'
import persistState, { mergePersistedState } from 'redux-localstorage'
import filter from 'redux-localstorage-filter'
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
import { compose, createStore, applyMiddleware } from 'redux'
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

const indexDbAdapter = {
  put: (key, value, callback) => idbKeyval.set(key, value).then(callback),
  get: (key, callback) => {
    idbKeyval
      .get(key)
      .then(res => callback(null, res))
      .catch(callback)
  },
  del: (key, callback) => idbKeyval.del(key).then(callback)
}

const storage = compose(
  filter([
    'logsPage.maxLogs',
    'logsPage.sideLogsOpen',
    'logsPage.styleConfig',
    'logsPage.visibleEvents'
  ])
)(indexDbAdapter)

const reducer = compose(
  mergePersistedState((initialState, persistedState) => ({
    ...initialState,
    logsPage: { ...initialState.logsPage, ...persistedState.logsPage }
  }))
)(appReducer)

const store = createStore(
  reducer,
  compose(
    applyMiddleware(thunk.withExtraArgument(globalSf)),
    persistState(storage)
  )
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

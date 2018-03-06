import { combineReducers } from 'redux'
import logs from './pages/logs/reducer'
import feedback from './pages/feedback/reducer'

const appReducer = combineReducers({ logsPage: logs, feedbackPage: feedback })

export default appReducer

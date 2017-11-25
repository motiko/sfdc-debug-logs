import SF from './api/sf'
import React from 'react'
import ReactDOM from 'react-dom'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import FeedbackPage from './pages/feedback'
import LogsPage from './pages/logs'
import {getParam} from './utils'

const sf = new SF(getParam("host"), getParam("sid"))


class App extends React.Component {
  constructor(props){
    super(props)
    this.state = {pageName: "LogsPage"}
    this.handlePageChange = this.handlePageChange.bind(this)
  }

  handlePageChange(newPage){
    document.location.hash = newPage
    this.setPage(newPage)
  }

  setPage(pageName){
    if(this.isLegalPage(pageName)){
      this.setState({pageName})
    }else{
      this.setState({pageName: "LogsPage"})
    }
  }

  componentWillMount(){
    const firstPage = document.location.hash.slice(1)
    this.setPage(firstPage)
    window.addEventListener("popstate", (e) =>{
      const newPage = document.location.hash.slice(1)
      this.setPage(newPage)
    })
  }

  isLegalPage(pageName){
    return Object.keys(this.nameToPage()).indexOf(pageName) > -1
  }

  nameToPage(){
    return {
      LogsPage: <LogsPage changePage={this.handlePageChange} sf={sf}/>,
      FeedbackPage: <FeedbackPage changePage={this.handlePageChange}/>
    }
  }

  render() {
    let page = this.nameToPage()[this.state.pageName]
    return (
      <MuiThemeProvider>
        {page}
      </MuiThemeProvider>)
  }
}

function render() {
  ReactDOM.render(<App/>, document.getElementById("container"))
}

render()

var React = require('react')
var ReactDOM = require('react-dom')

function Hello(props){
    return (<div> Hi, {props.name}!</div>)
}

ReactDOM.render(<Hello name="You"/>, document.getElementById("container"))

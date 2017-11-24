import React from 'react'

const messages = [
  {
    "_id": "5a1796db3e0d4f0208d224e7",
    "body": "Do you think you can tell",
    "author": "pink",
    "createdAt": 1511495387263,
    "replies": [
      {
        "body": "Which one is pink by the way",
        "author": "manager",
        "createdAt": 1511495410511
      }
    ]
  }
]

export default class FeedbackPage extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    return messages.map((m, i) => <Message msg={m} key={i}/>)
  }
}

function Message(props) {
  return (<div>
    <h6>
      {props.msg.author}
    </h6>
    <p>
      {props.msg.body}
    </p>
  </div>)
}

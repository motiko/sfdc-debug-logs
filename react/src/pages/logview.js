import React from 'react'

export default function LogView(props){
  return(
    <p>
      {props.match.params.id}
    </p>
  )
}

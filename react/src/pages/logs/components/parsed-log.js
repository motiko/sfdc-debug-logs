import globalSf from '../../../global-sf'
import React from 'react'
import Icon from 'material-ui/Icon'
import AddIcon from 'material-ui-icons/AddCircle'
import RemoveIcon from 'material-ui-icons/RemoveCircle'
import IconButton from 'material-ui/IconButton'
import { withStyles } from 'material-ui/styles'
import { logThemes } from './log-themes'

const styles = theme => ({
  expandButton: {
    margin: 0,
    fontSize: 15,
    height: '1.5em',
    top: '0.2em'
  },
  logBodyPre: {
    whiteSpace: 'pre-wrap',
    fontSize: 17,
    lineHeight: '140%',
    fontFamily: "'Courier New', 'Courier', mono",
    marginLeft: '20px',
    overflowWrap: 'break-word'
  }
})

const idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g,
  logEntryToDivTagClass = {
    USER_DEBUG: 'debug',
    SYSTEM_: 'system',
    SOQL_EXECUTE_: 'soql',
    SOQL_EXECUTE_END: 'soql',
    METHOD_: 'method',
    CONSTRUCTOR_: 'method',
    EXCEPTION_: 'err',
    FATAL_ERROR: 'err',
    CODE_UNIT: 'method',
    CALLOUT: 'callout',
    VALIDATION_: 'method',
    EXECUTION_: 'rest',
    DML_BEGIN: 'rest',
    DML_END: 'rest',
    ENTERING_MANAGED_PKG: 'system'
  }

function ParsedLog({ body, classes, style }) {
  if (!body || body === '') return <div />
  const intro = body.match(
    /^\d{1,2}\.\d\s[^]*?(?=\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\))/m
  )
  const theRest = body.match(
    /^\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|[A-Z_]*[^]*?(?=\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\))/gm
  )
  return (
    <pre className={classes.logBodyPre} style={{ fontSize: style.fontSize }}>
      <div id="debugText">
        <div style={{ color: logThemes[style.theme]['system'] }}>{intro}</div>
        {theRest.map((body, index) => {
          return <LogElement body={body} theme={style.theme} key={index} />
        })}
        {null}
      </div>
    </pre>
  )
}

export default withStyles(styles)(ParsedLog)

@withStyles(styles)
class LogElement extends React.Component {
  constructor(props) {
    super(props)
    this.toggleIndentation = this.toggleIndentation.bind(this)
    this.state = { indented: props.indented }
  }

  toggleIndentation() {
    this.setState(prevState => ({
      ...prevState,
      indented: !prevState.indented
    }))
  }

  render() {
    const { body, classes, theme } = this.props
    const { indented } = this.state
    const eventTypeMatch = /^\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|([A-Z_]*)/.exec(
      body
    )
    if (!eventTypeMatch) {
      console.error(`Didn't find event type for ${body} `)
      return null
    }
    const eventType = eventTypeMatch[1]
    const beautify = elementBody => {
      if (eventType === 'USER_DEBUG' && indented) {
        const parsedUserDebug = elementBody.match(
          /^(\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|USER_DEBUG\|[\d+\]\|[A-Z_]+\|)([^]*)/m
        )
        if (parsedUserDebug && parsedUserDebug.length > 2) {
          return `${parsedUserDebug[1]}${beautifyUserDebug(parsedUserDebug[2])}`
        }
      }
      return elementBody
    }

    const addLinks = elementBody => {
      if (!idRegex.test(elementBody)) return elementBody
      let textElements = elementBody.split(idRegex)
      let result = []
      elementBody.replace(idRegex, id => {
        result.push(textElements.shift())
        result.push(
          <a
            href={`https://${globalSf.hostname}/${id}`}
            style={{ color: logThemes[theme][className] }}
            key={result.length}
          >
            {id}
          </a>
        )
      })
      return result
    }

    const filtered = Object.entries(logEntryToDivTagClass).find(me =>
      eventType.startsWith(me[0])
    )
    const className = filtered ? filtered[1] : 'rest'
    return (
      <div style={{ color: logThemes[theme][className] }}>
        {eventType === 'USER_DEBUG' ? (
          <IconButton
            color="contrast"
            className={classes.expandButton}
            aria-label="Add"
            onClick={this.toggleIndentation}
          >
            {indented ? <RemoveIcon /> : <AddIcon />}
          </IconButton>
        ) : null}
        {addLinks(beautify(body), className)}
      </div>
    )
  }
}

function beautifyUserDebug(userDebug) {
  if (looksLikeHtml(userDebug)) {
    return html_beautify(userDebug)
  }
  if (isJsonString(userDebug)) {
    return JSON.stringify(JSON.parse(userDebug), null, 2)
  }
  if (looksLikeSfdcObject(userDebug)) {
    return js_beautify(sfdcObjectBeautify(userDebug))
  }
  return userDebug
}

function isJsonString(str) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

function sfdcObjectBeautify(string) {
  string = string.replace(/={/g, ':{')
  return string.replace(/([{| |\[]\w+)=(.+?)(?=, |},|}\)|:{|])/g, function(
    match,
    p1,
    p2
  ) {
    return p1 + ":'" + p2 + "'"
  })
}

function looksLikeSfdcObject(string) {
  return string.match(/\w+:{\w+=.+,?\s*}/)
}

function looksLikeHtml(source) {
  var trimmed = source.replace(/^[ \t\n\r]+/, '')
  return trimmed && trimmed.substring(0, 1) === '<'
}

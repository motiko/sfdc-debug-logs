import globalSf from '../../../global-sf'
import React from 'react'
import AddIcon from 'material-ui-icons/AddCircle'
import RemoveIcon from 'material-ui-icons/RemoveCircle'
import IconButton from 'material-ui/IconButton'
import { withStyles } from 'material-ui/styles'
import { connect } from 'react-redux'
import {
  splitLog,
  filterEntries,
  eventTypeOf,
  eventCategory,
  splitAtIds,
  indentUserDebug
} from '../log-parsing'
const styles = theme => ({
  expandButton: {
    margin: 0,
    fontSize: 15,
    height: '1.5em',
    top: '0.2em'
  },
  logBodyPre: {
    whiteSpace: 'pre-wrap',
    lineHeight: '140%',
    fontFamily: "'Courier New', 'Courier', mono",
    marginLeft: '20px',
    overflowWrap: 'break-word'
  },
  logElement: {
    marginLeft: '0.6em',
    marginTop: '0.6em'
  }
})

function ParsedLog({ body, classes, logStyleConfig, visibleEvents }) {
  if (!body || body === '') return <div />
  const { intro, entries } = splitLog(body)
  const visibleRest = filterEntries(entries, visibleEvents)
  return (
    <pre
      className={classes.logBodyPre}
      style={{
        fontSize: logStyleConfig.fontSize,
        whiteSpace: logStyleConfig.textWrap ? 'pre-wrap' : 'pre',
        overflowWrap: logStyleConfig.textWrap ? 'break-word' : 'normal'
      }}
    >
      <div
        style={{ color: logStyleConfig.theme.system }}
        className={classes.logElement}
      >
        {intro}
      </div>
      {visibleRest.map((body, index) => {
        return (
          <LogElement
            body={body}
            logTheme={logStyleConfig.theme}
            key={index}
            className={classes.logElement}
          />
        )
      })}
    </pre>
  )
}

const mapStateToProps = state => ({
  visibleEvents: state.logsPage.visibleEvents
})

export default connect(mapStateToProps, () => ({}))(
  withStyles(styles)(ParsedLog)
)

class LogElementBase extends React.Component {
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
    const { body, classes, logTheme } = this.props
    const { indented } = this.state
    const eventType = eventTypeOf(body)
    if (eventType === null) {
      console.error(`Didn't find event type for ${body} `)
      return null
    }
    const beautify = elementBody =>
      eventType === 'USER_DEBUG' && indented
        ? indentUserDebug(elementBody)
        : elementBody

    // Turns Salesforce ids into links and keeps all text around them.
    const addLinks = elementBody => {
      const parts = splitAtIds(elementBody)
      if (parts.length === 1) return elementBody
      return parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            href={`https://${globalSf.hostname}/${part}`}
            style={{ color: logTheme[className] }}
            key={index}
          >
            {part}
          </a>
        ) : (
          part
        )
      )
    }

    const className = eventCategory(eventType)
    return (
      <div
        style={{ color: logTheme[className] }}
        className={classes.logElement}
      >
        {eventType === 'USER_DEBUG' ? (
          <IconButton
            color="inherit"
            className={classes.expandButton}
            aria-label="Add"
            onClick={this.toggleIndentation}
            style={{ color: logTheme.rest }}
          >
            {indented ? <RemoveIcon /> : <AddIcon />}
          </IconButton>
        ) : null}
        {addLinks(beautify(body), className)}
      </div>
    )
  }
}

const LogElement = withStyles(styles)(LogElementBase)

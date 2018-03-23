import React from 'react'
import { connect } from 'react-redux'
import { updateColor } from './actions'
import ColorPicker from 'material-ui-color-picker'
import Grid from 'material-ui/Grid'
import { logEventToType } from '../../constants'

const typeToLogEvents = (desiredType, eventToType) =>
  Object.entries(eventToType)
    .filter(([event, type]) => desiredType == type)
    .map(([event, type]) => event)

@connect(
  state => state.logsPage.styleConfig.theme,
  dispatch => ({
    updateColor: (name, newColor) => dispatch(updateColor(name, newColor))
  })
)
export default class ColorPickers extends React.Component {
  render() {
    const { theme } = this.props
    const { updateColor } = this.props
    return (
      <Grid
        container
        direction="row"
        style={{ marginTop: '24px', marginLeft: '8px' }}
      >
        {Object.keys(theme)
          .filter(key => key !== 'themeName')
          .map(propertyName => (
            <Grid item md={4} key={propertyName}>
              <ColorPicker
                name="color"
                value={theme[propertyName]}
                onChange={newValue => updateColor(propertyName, newValue)}
                label={
                  propertyName[0].toUpperCase() + propertyName.substring(1)
                }
                TextFieldProps={{
                  helperText: typeToLogEvents(
                    propertyName,
                    logEventToType
                  ).join(' ')
                }}
              />
            </Grid>
          ))}
      </Grid>
    )
  }
}

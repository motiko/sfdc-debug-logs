import React from 'react'
import { connect } from 'react-redux'
import { updateColor } from '../actions'
import ColorPicker from 'material-ui-color-picker'

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
      <div style={{ marginTop: '24px' }}>
        <ColorPicker
          name="color"
          value={theme.background}
          onChange={newValue => updateColor('background', newValue)}
          label="Background"
        />
      </div>
    )
  }
}

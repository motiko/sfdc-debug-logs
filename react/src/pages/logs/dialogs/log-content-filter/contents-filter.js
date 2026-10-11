import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material'
import { allEventTypes } from '../../constants'
import {
  addVisibleEvents,
  clearVisibleEvents,
  removeVisibleEvent,
  toggleContentsFilter
} from '../../logs-slice'

const ITEM_HEIGHT = 48

// Picks the event types the log body shows (all when none is picked).
export default function ContentsFilter() {
  const dispatch = useDispatch()
  const selected = useSelector(state => state.logsPage.visibleEvents)
  const isOpen = useSelector(state => state.logsPage.contentsFilterOpen)
  const [input, setInput] = useState('')
  const available = allEventTypes.filter(type => !selected.includes(type))
  const close = () => dispatch(toggleContentsFilter())

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      fullWidth
      aria-labelledby="contents-filter-title"
    >
      <DialogTitle id="contents-filter-title">Filter log contents</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={available}
          value={null}
          inputValue={input}
          onInputChange={(e, value, reason) =>
            setInput(reason === 'reset' ? '' : value)
          }
          onChange={(e, eventType) => {
            if (eventType) dispatch(addVisibleEvents([eventType]))
            setInput('')
          }}
          renderInput={params => (
            <TextField
              {...params}
              autoFocus
              variant="standard"
              placeholder="Filter by event type"
              slotProps={{
                htmlInput: {
                  ...params.inputProps,
                  'aria-label': 'Event type to show'
                }
              }}
            />
          )}
        />
        <Box
          sx={{
            mt: 2,
            maxHeight: ITEM_HEIGHT * 4,
            minHeight: ITEM_HEIGHT * 4,
            overflow: 'auto'
          }}
        >
          {selected.map(item => (
            <Chip
              key={item}
              label={item}
              onDelete={() => dispatch(removeVisibleEvent(item))}
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => dispatch(clearVisibleEvents())}>
          Remove All
        </Button>
        <Button onClick={() => dispatch(addVisibleEvents(allEventTypes))}>
          Add All
        </Button>
      </DialogActions>
    </Dialog>
  )
}

import { useState } from 'react'
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

// Searches the loaded logs' bodies on Enter or the search button; clearing the
// field (or Escape) shows all logs again.
export default function Search({ handleSearch }) {
  const [searchTerm, setSearchTerm] = useState('')

  const updateSearchTerm = newTerm => {
    if (newTerm === '') handleSearch('')
    setSearchTerm(newTerm)
  }

  const handleKey = e => {
    if (e.key === 'Enter') handleSearch(searchTerm)
    if (e.key === 'Escape') updateSearchTerm('')
  }

  return (
    <TextField
      id="search"
      type="search"
      variant="standard"
      label="Find in Logs"
      value={searchTerm}
      onKeyUp={handleKey}
      onChange={e => updateSearchTerm(e.target.value)}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Search">
                <IconButton
                  color="inherit"
                  aria-label="Search"
                  onClick={() => handleSearch(searchTerm)}
                >
                  <SearchIcon />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          )
        }
      }}
    />
  )
}

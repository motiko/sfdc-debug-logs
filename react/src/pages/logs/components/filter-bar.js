import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Popover,
  TextField,
  Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FilterIcon from '@mui/icons-material/FilterList'
import CloseIcon from '@mui/icons-material/Close'
import { applyFilter, clearFilters, clearSearch, searchLogs } from '../actions'
import {
  activeFilterChips,
  DURATION_STEPS,
  FAILED,
  formatBytes,
  formatDuration,
  NO_FILTERS,
  shortOperation,
  SIZE_STEPS
} from '../utils'

const SEARCH_DELAY_MS = 400

// Under the header: search in the loaded logs (live, debounced, ignoring
// case, with progress and a persistent result), the active list filters as
// removable chips, the Filters popover, and how many logs are shown.
// Nothing is filtered unless it shows here (docs/ux/baseline-review.md B1).
const FilterBar = forwardRef(function FilterBar({ shownCount }, searchRef) {
  const dispatch = useDispatch()
  const logs = useSelector(state => state.logsPage.logs)
  const filters = useSelector(state => state.logsPage.filters)
  const search = useSelector(state => state.logsPage.search)
  const [term, setTerm] = useState(search.term)
  const [filtersAnchor, setFiltersAnchor] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const runSearch = value => {
    clearTimeout(timer.current)
    dispatch(value.trim() ? searchLogs(value) : clearSearch())
  }
  const onChange = e => {
    const value = e.target.value
    setTerm(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => runSearch(value),
      value ? SEARCH_DELAY_MS : 0
    )
  }
  const onKeyDown = e => {
    if (e.key === 'Enter') runSearch(term)
    if (e.key === 'Escape' && term) {
      e.stopPropagation()
      setTerm('')
      runSearch('')
    }
  }
  const resetSearch = () => {
    setTerm('')
    runSearch('')
  }

  const chips = activeFilterChips(filters)
  const filtered = chips.length > 0 || search.matches !== null
  const total = logs.length
  const searching = search.status === 'searching'
  const countText =
    search.matches !== null
      ? `${shownCount} of ${total} logs match “${search.term}”` +
        (search.failed ? ` (${search.failed} could not be downloaded)` : '')
      : filtered
        ? `${shownCount} of ${total} logs`
        : `${total} logs`

  return (
    <Box
      component="section"
      aria-label="Search and filters"
      sx={{
        position: 'relative',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 1
        }}
      >
        <Box
          component="div"
          role="search"
          sx={{ flex: '0 1 320px', minWidth: 200 }}
        >
          <TextField
            id="search"
            inputRef={searchRef}
            type="search"
            fullWidth
            value={term}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={`Search in ${total} loaded logs`}
            autoComplete="off"
            slotProps={{
              htmlInput: {
                'aria-label': 'Search in loaded logs',
                'aria-keyshortcuts': '/'
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" aria-hidden />
                  </InputAdornment>
                )
              }
            }}
          />
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<FilterIcon />}
          aria-haspopup="dialog"
          aria-expanded={Boolean(filtersAnchor)}
          onClick={e => setFiltersAnchor(e.currentTarget)}
          sx={{ borderColor: 'var(--ad-border)' }}
        >
          {chips.length ? `Filters (${chips.length})` : 'Filters'}
        </Button>
        <Box
          component="ul"
          aria-label="Active filters"
          sx={{ display: 'contents', listStyle: 'none', m: 0, p: 0 }}
        >
          {chips.map(chip => (
            <Box component="li" key={chip.key} sx={{ display: 'inline-flex' }}>
              <Chip
                label={chip.label}
                variant="outlined"
                onDelete={() =>
                  dispatch(applyFilter(chip.key, NO_FILTERS[chip.key]))
                }
                onClick={() =>
                  dispatch(applyFilter(chip.key, NO_FILTERS[chip.key]))
                }
                deleteIcon={<CloseIcon aria-hidden />}
                aria-label={`Remove filter ${chip.label}`}
              />
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: '1 1 auto' }} />
        <Typography
          variant="body2"
          color="text.secondary"
          component="p"
          data-testid="list-count"
          sx={{ m: 0, whiteSpace: 'nowrap' }}
        >
          {searching
            ? `Searching ${search.done} of ${search.total} logs…`
            : countText}
        </Typography>
        {/* Announces the result once, not every download step. */}
        <span className="sr-only" role="status">
          {searching || search.matches === null ? '' : countText}
        </span>
        {filtered ? (
          <Button
            variant="text"
            onClick={() => {
              resetSearch()
              if (chips.length) dispatch(clearFilters())
            }}
          >
            Clear all
          </Button>
        ) : null}
      </Box>
      {searching ? (
        <LinearProgress
          variant="determinate"
          value={search.total ? (100 * search.done) / search.total : 0}
          aria-label="Downloading logs to search"
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <FiltersPopover
        anchor={filtersAnchor}
        onClose={() => setFiltersAnchor(null)}
        logs={logs}
        filters={filters}
      />
    </Box>
  )
})

export default FilterBar

// The list filters, applied as soon as they change (and sent to Salesforce,
// so they also find logs beyond the loaded ones).
function FiltersPopover({ anchor, onClose, logs, filters }) {
  const dispatch = useDispatch()
  const values = useMemo(() => {
    const unique = list => [...new Set(list.filter(Boolean))].sort()
    return {
      user: unique([
        ...logs.map(l => l.LogUser && l.LogUser.Name),
        filters.user
      ]),
      operation: unique([...logs.map(l => l.Operation), filters.operation]),
      status: unique([
        ...logs.map(l => l.Status),
        filters.status !== FAILED && filters.status
      ])
    }
  }, [logs, filters])
  const set = key => e => dispatch(applyFilter(key, e.target.value))
  const field = (key, label, options) => (
    <TextField
      select
      fullWidth
      label={label}
      value={filters[key]}
      onChange={set(key)}
      id={`filter-${key}`}
    >
      {options.map(([value, text]) => (
        <MenuItem key={String(value)} value={value}>
          {text}
        </MenuItem>
      ))}
    </TextField>
  )
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': 'Filters',
          sx: {
            p: 2,
            width: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }
        }
      }}
    >
      <Typography component="h2" variant="h2">
        Filter logs
      </Typography>
      {field('user', 'User', [
        ['', 'Any user'],
        ...values.user.map(v => [v, v])
      ])}
      {field('operation', 'Operation', [
        ['', 'Any operation'],
        ...values.operation.map(v => [v, shortOperation(v)])
      ])}
      {field('status', 'Status', [
        ['', 'Any status'],
        [FAILED, 'Failed only'],
        ...values.status.map(v => [v, v])
      ])}
      {field('minLength', 'Size', [
        [0, 'Any size'],
        ...SIZE_STEPS.map(n => [n, `Larger than ${formatBytes(n)}`])
      ])}
      {field('minDuration', 'Duration', [
        [0, 'Any duration'],
        ...DURATION_STEPS.map(n => [n, `Longer than ${formatDuration(n)}`])
      ])}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          onClick={() => dispatch(clearFilters())}
          disabled={activeFilterChips(filters).length === 0}
        >
          Clear filters
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </Box>
    </Popover>
  )
}

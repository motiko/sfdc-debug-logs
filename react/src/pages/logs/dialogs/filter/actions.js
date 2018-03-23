export function toggleFiltersDialog() {
  return { type: 'TOGGLE_FILTERS_DIALOG' }
}

export function updateFilter(filterName, newValue) {
  return { type: 'UPDATE_FILTER', filterName, newValue }
}

export function clearFilters() {
  return { type: 'CLEAR_FILTERS' }
}

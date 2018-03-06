export function filterLogs(logs, filters) {
  const upcase = string => string.charAt(0).toUpperCase() + string.slice(1)
  const activeFilters = Object.entries(filters).filter(([key, val]) => {
    return val && val != null && val != ''
  })
  return Object.values(logs)
    .filter(log => !log.not_matches_search)
    .filter(log => {
      return activeFilters
        .map(([filterName, filterValue]) => {
          switch (filterName) {
            case 'user':
              return log.LogUser.Name === filterValue
              break
            default:
              return log[upcase(filterName)] === filterValue
          }
        })
        .every(x => x)
    })
}

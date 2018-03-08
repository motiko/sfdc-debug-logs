const upcase = string => string.charAt(0).toUpperCase() + string.slice(1)

const filterActiveFilters = filters => {
  return Object.entries(filters).filter(([key, { value }]) => {
    return value && value != null && value != ''
  })
}

const escapeSingleQuotes = string => {
  return string.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const byType = desiredType => ([name, { type: actualType }]) =>
  actualType == desiredType

function matchesByText(log, filters) {
  return filters
    .filter(byType('text'))
    .map(([filterName, { value: filterValue }]) => {
      switch (filterName) {
        case 'user':
          return log.LogUser.Name === filterValue
          break
        default:
          return log[upcase(filterName)] === filterValue
      }
    })
    .every(x => x)
}

export function filterLogs(logs, filters, notMatchingSearchLogs) {
  const activeFilters = filterActiveFilters(filters)
  return Object.values(logs)
    .filter(log => !notMatchingSearchLogs[log.Id])
    .filter(log => matchesByText(log, activeFilters))
  // .filter(log => matchesByNumber(log, activeFilters))
}

export function filtersToWhereClause(filters) {
  const filterNameToSql = {
    user: 'LogUser.Name',
    operation: 'Operation',
    status: 'Status'
  }
  const activeFilters = filterActiveFilters(filters)
  if (activeFilters.length === 0) return ''
  const fullQuery = activeFilters.reduce(
    (query, [filterName, { value: filterValue }]) => {
      if (filterNameToSql[filterName]) {
        return `${query} ${filterNameToSql[filterName]} = '${escapeSingleQuotes(
          filterValue
        )}' AND`
      }
      return query
    },
    'WHERE'
  )
  return fullQuery.substring(0, fullQuery.length - 3)
}

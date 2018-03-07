const upcase = string => string.charAt(0).toUpperCase() + string.slice(1)

const filterActiveFilters = filters => {
  return Object.entries(filters).filter(([key, val]) => {
    return val && val != null && val != ''
  })
}

const escapeSingleQuotes = string => {
  return string.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function filterLogs(logs, filters, notMatchingSearchLogs) {
  const activeFilters = filterActiveFilters(filters)
  return Object.values(logs)
    .filter(log => !notMatchingSearchLogs[log.Id])
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

export function filtersToWhereClause(filters) {
  const filterNameToSql = {
    user: 'LogUser.Name',
    operation: 'Operation',
    status: 'Status'
  }
  const activeFilters = filterActiveFilters(filters)
  console.log(activeFilters)
  if (activeFilters.length === 0) return ''
  const fullQuery = activeFilters.reduce((query, [filterName, filterValue]) => {
    if (filterNameToSql[filterName]) {
      return `${query} ${filterNameToSql[filterName]} = '${escapeSingleQuotes(
        filterValue
      )}' AND`
    }
    return query
  }, 'WHERE')
  console.log(fullQuery)
  return fullQuery.substring(0, fullQuery.length - 3)
}

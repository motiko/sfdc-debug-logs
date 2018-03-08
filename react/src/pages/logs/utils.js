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

function matchesByNumber(log, filters) {
  const filterNameToFieldName = {
    length: 'LogLength',
    duration: 'DurationMilliseconds'
  }
  return filters
    .filter(byType('number'))
    .map(([filterName, { value: filterValue }]) => {
      const fieldName = filterNameToFieldName[filterName]
      const fieldValue = log[fieldName]
      return fieldValue >= filterValue[0] && fieldValue <= filterValue[1]
    })
    .every(x => x)
}

export function filterLogs(logs, filters, notMatchingSearchLogs) {
  const activeFilters = filterActiveFilters(filters)
  return Object.values(logs)
    .filter(log => !notMatchingSearchLogs[log.Id])
    .filter(log => matchesByText(log, activeFilters))
    .filter(log => matchesByNumber(log, activeFilters))
}

export function filtersToWhereClause(filters) {
  const textFilterToSql = {
    user: 'LogUser.Name',
    operation: 'Operation',
    status: 'Status'
  }
  const numericFilterToSql = {
    length: 'LogLength',
    duration: 'DurationMilliseconds'
  }
  const activeFilters = filterActiveFilters(filters)
  if (activeFilters.length === 0) return ''
  const fullQuery = activeFilters.reduce(
    (query, [filterName, { value: filterValue }]) => {
      if (textFilterToSql[filterName]) {
        return `${query} ${filterNameToSql[filterName]} = '${escapeSingleQuotes(
          filterValue
        )}' AND`
      }
      if (numericFilterToSql[filterName]) {
        const fieldName = numericFilterToSql[filterName]
        return `${query} ${fieldName} >= ${parseInt(
          filterValue[0]
        )} AND ${fieldName} <= ${parseInt(filterValue[1])} AND`
      }
      return query
    },
    'WHERE'
  )
  return fullQuery.substring(0, fullQuery.length - 3)
}

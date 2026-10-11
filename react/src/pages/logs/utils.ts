// Log list filters (dialogs/filter): applied locally to loaded logs
// (filterLogs) and sent to Salesforce as a SOQL WHERE clause
// (filtersToWhereClause).

export type Filter =
  { type: 'text'; value: string } | { type: 'number'; value: [number, number] }

export type Filters = Record<string, Filter>

// The ApexLog fields the filters read (Tooling API record).
export interface ApexLog {
  Id: string
  LogUser: { Name: string }
  Operation?: string
  Status?: string
  LogLength?: number
  DurationMilliseconds?: number
  [field: string]: unknown
}

type FilterEntry = [string, Filter]

const upcase = (string: string) =>
  string.charAt(0).toUpperCase() + string.slice(1)

const filterActiveFilters = (filters: Filters): FilterEntry[] => {
  return Object.entries(filters).filter(([key, { value }]) => {
    return value && value != null && value != ''
  })
}

const escapeSingleQuotes = (string: string) => {
  return string.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const byType =
  (desiredType: Filter['type']) =>
  ([name, { type: actualType }]: FilterEntry) =>
    actualType == desiredType

function matchesByText(log: ApexLog, filters: FilterEntry[]) {
  return filters
    .filter(byType('text'))
    .map(([filterName, { value: filterValue }]) => {
      switch (filterName) {
        case 'user':
          return log.LogUser.Name === filterValue
        default:
          return log[upcase(filterName)] === filterValue
      }
    })
    .every(x => x)
}

function matchesByNumber(log: ApexLog, filters: FilterEntry[]) {
  const filterNameToFieldName = {
    length: 'LogLength',
    duration: 'DurationMilliseconds'
  }
  return filters
    .filter(byType('number'))
    .map(([filterName, { value: filterValue }]) => {
      const fieldName = filterNameToFieldName[filterName]
      const fieldValue = log[fieldName] as number
      const [min, max] = filterValue as [number, number]
      return fieldValue >= min && fieldValue <= max
    })
    .every(x => x)
}

export function filterLogs(
  logs: Record<string, ApexLog>,
  filters: Filters,
  notMatchingSearchLogs: Record<string, boolean>
): ApexLog[] {
  const activeFilters = filterActiveFilters(filters)
  return Object.values(logs)
    .filter(log => !notMatchingSearchLogs[log.Id])
    .filter(log => matchesByText(log, activeFilters))
    .filter(log => matchesByNumber(log, activeFilters))
}

export function filtersToWhereClause(filters: Filters): string {
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
        return `${query} ${textFilterToSql[filterName]} = '${escapeSingleQuotes(
          filterValue as string
        )}' AND`
      }
      if (numericFilterToSql[filterName]) {
        const fieldName = numericFilterToSql[filterName]
        const [min, max] = filterValue as [number, number]
        // Whole numbers only: the value goes into the SOQL query as is.
        return `${query} ${fieldName} >= ${parseInt(String(min))} AND ${fieldName} <= ${parseInt(String(max))} AND`
      }
      return query
    },
    'WHERE'
  )
  return fullQuery.substring(0, fullQuery.length - 3)
}

import { describe, it, expect } from 'vitest'
import {
  activeFilterChips,
  FAILED,
  filterLogs,
  filtersToWhereClause,
  formatBytes,
  formatClock,
  formatDuration,
  formatRelative,
  formatStartTime,
  NO_FILTERS,
  shortOperation,
  sortLogs,
  type ApexLog
} from './utils'

// Tooling API ApexLog records, as returned by sf.recentLogs().
function apexLog(fields: Partial<ApexLog> & { Id: string }): ApexLog {
  return {
    LogUser: { Name: 'Ada Admin' },
    Operation: '/services/data/v62.0/tooling/executeAnonymous/',
    Status: 'Success',
    LogLength: 4210,
    DurationMilliseconds: 85,
    StartTime: '2026-10-11T10:01:02.000+0000',
    ...fields
  }
}

const logs = [
  apexLog({ Id: '07L000000000001AAA' }),
  apexLog({
    Id: '07L000000000002AAA',
    LogUser: { Name: "Pat O'Brien" },
    Operation: 'Batch Apex',
    Status: 'Attempt to de-reference a null object',
    LogLength: 19_525_305,
    DurationMilliseconds: 93_660,
    StartTime: '2026-10-11T10:00:00.000+0000'
  }),
  apexLog({
    Id: '07L000000000003AAA',
    Operation: 'VF Remoting',
    LogLength: 120000,
    DurationMilliseconds: 366,
    StartTime: '2026-10-11T10:05:00.000+0000'
  })
]

const ids = (list: ApexLog[]) => list.map(log => log.Id.slice(-4, -3))

describe('no hidden default filters (B1)', () => {
  it('queries nothing extra and keeps every log, however large or slow', () => {
    expect(filtersToWhereClause(NO_FILTERS)).toBe('')
    expect(ids(filterLogs(logs, NO_FILTERS))).toEqual(['1', '2', '3'])
    expect(activeFilterChips(NO_FILTERS)).toEqual([])
  })
})

describe('filtersToWhereClause', () => {
  it('maps each filter to its SOQL condition, escaping text', () => {
    expect(
      filtersToWhereClause({
        user: "Pat O'Brien",
        operation: 'Batch Apex',
        status: 'Success',
        minLength: 1_000_000,
        minDuration: 5000
      })
    ).toBe(
      "WHERE LogUser.Name = 'Pat O\\'Brien' AND Operation = 'Batch Apex' AND Status = 'Success' " +
        'AND LogLength >= 1000000 AND DurationMilliseconds >= 5000'
    )
  })

  it('asks for failed logs as status other than Success', () => {
    expect(filtersToWhereClause({ ...NO_FILTERS, status: FAILED })).toBe(
      "WHERE Status != 'Success'"
    )
  })

  it('only puts whole numbers into the query', () => {
    expect(
      filtersToWhereClause({ ...NO_FILTERS, minLength: '5 OR 1=1' as never })
    ).toBe('')
    expect(filtersToWhereClause({ ...NO_FILTERS, minDuration: 12.7 })).toBe(
      'WHERE DurationMilliseconds >= 12'
    )
  })
})

describe('filterLogs', () => {
  it('applies every set filter to the loaded logs', () => {
    expect(ids(filterLogs(logs, { ...NO_FILTERS, user: 'Ada Admin' }))).toEqual(
      ['1', '3']
    )
    expect(ids(filterLogs(logs, { ...NO_FILTERS, status: FAILED }))).toEqual([
      '2'
    ])
    expect(
      ids(filterLogs(logs, { ...NO_FILTERS, minLength: 100_000 }))
    ).toEqual(['2', '3'])
    expect(ids(filterLogs(logs, { ...NO_FILTERS, minDuration: 1000 }))).toEqual(
      ['2']
    )
  })

  it('keeps only logs that contain the search term while searching', () => {
    const matches = { '07L000000000003AAA': 2, '07L000000000001AAA': 0 }
    expect(ids(filterLogs(logs, NO_FILTERS, matches))).toEqual(['3'])
    expect(ids(filterLogs(logs, NO_FILTERS, {}))).toEqual([])
  })
})

describe('activeFilterChips', () => {
  it('describes each active filter in words', () => {
    expect(
      activeFilterChips({
        user: 'Ada Admin',
        operation: '/services/data/v62.0/tooling/executeAnonymous/',
        status: FAILED,
        minLength: 1_000_000,
        minDuration: 5000
      }).map(c => c.label)
    ).toEqual([
      'User: Ada Admin',
      'Operation: executeAnonymous',
      'Failed only',
      'Larger than 1 MB',
      'Longer than 5 s'
    ])
  })
})

describe('sortLogs', () => {
  it('sorts by time, duration or size, keeping ties in order', () => {
    expect(ids(sortLogs(logs, { key: 'time', direction: 'desc' }))).toEqual([
      '3',
      '1',
      '2'
    ])
    expect(ids(sortLogs(logs, { key: 'size', direction: 'desc' }))).toEqual([
      '2',
      '3',
      '1'
    ])
    expect(ids(sortLogs(logs, { key: 'duration', direction: 'asc' }))).toEqual([
      '1',
      '3',
      '2'
    ])
  })
})

describe('formats', () => {
  it('shortens API paths to their last part', () => {
    expect(
      shortOperation('/services/data/v62.0/tooling/executeAnonymous/')
    ).toBe('executeAnonymous')
    expect(shortOperation('/apex/MyPage')).toBe('MyPage')
    expect(shortOperation('Batch Apex')).toBe('Batch Apex')
    expect(shortOperation(undefined)).toBe('')
  })

  it('formats sizes and durations with units and a space', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(16918)).toBe('16.9 KB')
    expect(formatBytes(192_865)).toBe('193 KB')
    expect(formatBytes(19_525_305)).toBe('19.5 MB')
    expect(formatDuration(63)).toBe('63 ms')
    expect(formatDuration(1234)).toBe('1.2 s')
    expect(formatDuration(125_000)).toBe('2 min 5 s')
  })

  it('shows the date only for logs from another day', () => {
    const now = new Date('2026-10-11T12:00:00')
    expect(formatStartTime('2026-10-11T10:01:02', now)).toMatch(/^10:01:02$/)
    expect(formatStartTime('2026-10-10T10:01:02', now)).toMatch(/10.*10:01:02$/)
    expect(formatStartTime(undefined, now)).toBe('')
  })

  it('names the day of a time that is not today', () => {
    const now = new Date('2026-10-11T12:00:00')
    expect(formatClock('2026-10-11T13:44:00', now)).toMatch(/^13:44$/)
    expect(formatClock('2026-10-12T13:44:00', now)).toMatch(/^tomorrow 13:44$/)
    expect(formatClock('2026-10-14T13:44:00', now)).toMatch(/14, 13:44$/)
    expect(formatClock(null, now)).toBe('')
  })

  it('says how long ago the list was updated', () => {
    expect(formatRelative(1000, 5000)).toBe('just now')
    expect(formatRelative(0, 125_000)).toBe('2 min ago')
  })
})

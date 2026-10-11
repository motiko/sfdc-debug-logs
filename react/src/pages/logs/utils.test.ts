import { describe, it, expect } from 'vitest'
import { filterLogs, filtersToWhereClause, type ApexLog } from './utils'
import { defaultFiltersState } from './dialogs/filter/reducer'

// Tooling API ApexLog records, as returned by sf.requestLogs().
function apexLog(fields: Partial<ApexLog> & { Id: string }): ApexLog {
  return {
    LogUser: { Name: 'Ada Admin' },
    Application: 'Unknown',
    Location: 'Monitoring',
    Operation: '/services/data/v62.0/tooling/executeAnonymous/',
    Request: 'API',
    Status: 'Success',
    LogLength: 4210,
    DurationMilliseconds: 85,
    StartTime: '2026-10-11T10:01:02.000+0000',
    ...fields
  }
}

const logs = {
  '07L000000000001AAA': apexLog({ Id: '07L000000000001AAA' }),
  '07L000000000002AAA': apexLog({
    Id: '07L000000000002AAA',
    LogUser: { Name: "Pat O'Brien" },
    Operation: 'Batch Apex',
    Status: 'Attempt to de-reference a null object',
    LogLength: 1641509,
    DurationMilliseconds: 9366
  }),
  '07L000000000003AAA': apexLog({
    Id: '07L000000000003AAA',
    Operation: 'VF Remoting',
    LogLength: 120000,
    DurationMilliseconds: 366
  })
}

const ids = (list: ApexLog[]) => list.map(log => log.Id)

describe('filtersToWhereClause', () => {
  it('returns an empty string when no filter is set', () => {
    expect(filtersToWhereClause({})).toBe('')
    expect(
      filtersToWhereClause({
        user: { type: 'text', value: '' },
        status: { type: 'text', value: '' }
      })
    ).toBe('')
  })

  it('maps text filters to their SOQL fields', () => {
    expect(
      filtersToWhereClause({
        user: { type: 'text', value: 'Ada Admin' },
        operation: { type: 'text', value: 'Batch Apex' },
        status: { type: 'text', value: 'Success' }
      })
    ).toBe(
      "WHERE LogUser.Name = 'Ada Admin' AND Operation = 'Batch Apex' AND Status = 'Success' "
    )
  })

  it('escapes quotes and backslashes in text filters', () => {
    expect(
      filtersToWhereClause({ user: { type: 'text', value: "Pat O'Brien" } })
    ).toBe("WHERE LogUser.Name = 'Pat O\\'Brien' ")
    expect(
      filtersToWhereClause({
        operation: { type: 'text', value: "a\\' OR Id != null OR '" }
      })
    ).toBe("WHERE Operation = 'a\\\\\\' OR Id != null OR \\'' ")
  })

  it('turns number filters into inclusive whole-number ranges', () => {
    expect(
      filtersToWhereClause({
        length: { type: 'number', value: [1024.7, 2048] },
        duration: { type: 'number', value: [0, 12000] }
      })
    ).toBe(
      'WHERE LogLength >= 1024 AND LogLength <= 2048 AND DurationMilliseconds >= 0 AND DurationMilliseconds <= 12000 '
    )
  })

  it('includes the default ranges of the filter dialog', () => {
    expect(filtersToWhereClause(defaultFiltersState as any)).toBe(
      'WHERE LogLength >= 0 AND LogLength <= 2500000 AND DurationMilliseconds >= 0 AND DurationMilliseconds <= 12000 '
    )
  })

  it('ignores unknown filters', () => {
    expect(
      filtersToWhereClause({
        application: { type: 'text', value: 'Unknown' },
        status: { type: 'text', value: 'Success' }
      })
    ).toBe("WHERE Status = 'Success' ")
  })
})

describe('filterLogs', () => {
  it('returns all logs with the default filters', () => {
    expect(ids(filterLogs(logs, defaultFiltersState as any, {}))).toEqual([
      '07L000000000001AAA',
      '07L000000000002AAA',
      '07L000000000003AAA'
    ])
  })

  it('leaves out logs that did not match the search', () => {
    expect(
      ids(
        filterLogs(
          logs,
          {},
          { '07L000000000001AAA': true, '07L000000000003AAA': false }
        )
      )
    ).toEqual(['07L000000000002AAA', '07L000000000003AAA'])
  })

  it('filters by user name', () => {
    expect(
      ids(
        filterLogs(logs, { user: { type: 'text', value: "Pat O'Brien" } }, {})
      )
    ).toEqual(['07L000000000002AAA'])
  })

  it('filters by operation and status (exact match)', () => {
    expect(
      ids(
        filterLogs(
          logs,
          { operation: { type: 'text', value: 'VF Remoting' } },
          {}
        )
      )
    ).toEqual(['07L000000000003AAA'])
    expect(
      ids(filterLogs(logs, { status: { type: 'text', value: 'success' } }, {}))
    ).toEqual([])
  })

  it('filters by inclusive length and duration ranges', () => {
    expect(
      ids(
        filterLogs(
          logs,
          {
            length: { type: 'number', value: [4210, 120000] },
            duration: { type: 'number', value: [0, 366] }
          },
          {}
        )
      )
    ).toEqual(['07L000000000001AAA', '07L000000000003AAA'])
  })

  it('combines filters', () => {
    expect(
      ids(
        filterLogs(
          logs,
          {
            user: { type: 'text', value: 'Ada Admin' },
            duration: { type: 'number', value: [100, 1000] }
          },
          {}
        )
      )
    ).toEqual(['07L000000000003AAA'])
  })
})

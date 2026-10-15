import { describe, expect, it } from 'vitest'
import log from './__fixtures__/limits-soql-dml.log?raw'
import anonymous from './__fixtures__/anonymous-apex.log?raw'
import { buildLines } from './log-lines'
import {
  limitLevel,
  MAX_ISSUES,
  nextOccurrence,
  rowOfLine,
  sortGroups,
  summarizeLog
} from './log-summary'

const lines = buildLines(log)
const summary = summarizeLog(lines)
const lineOf = (pattern: RegExp) => lines.find(l => pattern.test(l.text))

describe('summarizeLog: limits', () => {
  it('reads every limit per namespace, the default namespace first', () => {
    expect(summary.limits.map(n => n.namespace)).toEqual(['(default)', 'acme'])
    const limits = summary.limits[0].limits
    expect(limits).toHaveLength(13)
    expect(limits[0]).toEqual({
      name: 'Number of SOQL queries',
      used: 4,
      max: 100,
      line: lineOf(/LIMIT_USAGE_FOR_NS\|\(default\)/).number
    })
    expect(limits.find(l => l.name === 'Maximum CPU time')).toMatchObject({
      used: 9200,
      max: 10000
    })
    expect(limits.find(l => l.name === 'Maximum heap size')).toMatchObject({
      used: 4500000,
      max: 6000000
    })
    expect(summary.limits[1].limits.map(l => [l.name, l.used])).toEqual([
      ['Number of SOQL queries', 2],
      ['Number of query rows', 0],
      ['Number of DML statements', 0]
    ])
  })

  it('keeps the highest value when a namespace is reported more than once', () => {
    const twice = buildLines(
      [
        '62.0 APEX_CODE,DEBUG',
        '10:00:00.000 (1)|LIMIT_USAGE_FOR_NS|(default)|',
        '  Number of SOQL queries: 1 out of 100',
        '10:00:00.000 (2)|LIMIT_USAGE_FOR_NS|(default)|',
        '  Number of SOQL queries: 3 out of 100',
        '10:00:00.000 (3)|LIMIT_USAGE_FOR_NS|(default)|',
        '  Number of SOQL queries: 2 out of 100',
        ''
      ].join('\n')
    )
    expect(summarizeLog(twice).limits[0].limits).toEqual([
      { name: 'Number of SOQL queries', used: 3, max: 100, line: 2 }
    ])
  })

  it('reads the limits of the anonymous Apex fixture', () => {
    const s = summarizeLog(buildLines(anonymous))
    expect(s.limits[0].limits.map(l => `${l.name} ${l.used}/${l.max}`)).toEqual(
      ['Number of SOQL queries 1/100', 'Number of query rows 2/50000']
    )
    expect(s.issues).toEqual([])
    expect(s.soql).toMatchObject([
      { query: 'SELECT Id, Name FROM Account LIMIT 2', count: 1, rows: 2 }
    ])
  })
})

describe('summarizeLog: errors', () => {
  it('lists exceptions and fatal errors with their lines', () => {
    expect(summary.issues).toEqual([
      {
        eventType: 'EXCEPTION_THROWN',
        message:
          'System.NullPointerException: Attempt to de-reference a null object',
        sourceLine: 11,
        line: lineOf(/NullPointerException/).number
      },
      {
        eventType: 'EXCEPTION_THROWN',
        message: 'System.MathException: Divide by 0',
        sourceLine: 5,
        line: lineOf(/EXCEPTION_THROWN\|\[5\]/).number
      },
      {
        eventType: 'FATAL_ERROR',
        message: 'System.MathException: Divide by 0',
        sourceLine: null,
        line: lineOf(/FATAL_ERROR/).number
      }
    ])
    expect(summary.issuesTruncated).toBe(false)
  })

  it(`keeps the first ${MAX_ISSUES} errors`, () => {
    const many = ['62.0 APEX_CODE,DEBUG']
    for (let i = 0; i < MAX_ISSUES + 5; i++)
      many.push(`10:00:00.000 (${i})|EXCEPTION_THROWN|[1]|E${i}`)
    const s = summarizeLog(buildLines(many.join('\n')))
    expect(s.issues).toHaveLength(MAX_ISSUES)
    expect(s.issuesTruncated).toBe(true)
  })
})

describe('summarizeLog: SOQL', () => {
  it('groups queries by text with count, rows, time and the loop hint', () => {
    expect(summary.soqlCount).toBe(4)
    expect(summary.soql).toEqual([
      {
        query: 'SELECT Id FROM Contact WHERE AccountId = :tmpVar1',
        count: 3,
        rows: 5,
        timeMs: 4.5,
        lines: lines
          .filter(l => l.eventType === 'SOQL_EXECUTE_BEGIN')
          .slice(0, 3)
          .map(l => l.number),
        possibleLoop: true
      },
      {
        // Whitespace and line breaks collapsed.
        query:
          "SELECT Id, (SELECT Id FROM Contacts) FROM Account WHERE Name = 'Acme'",
        count: 1,
        rows: 1,
        timeMs: 10,
        lines: [lineOf(/Aggregations:1/).number],
        possibleLoop: false
      }
    ])
  })

  it('reads queries of logs without the Aggregations field', () => {
    const old = buildLines(
      [
        '30.0 APEX_CODE,DEBUG',
        '10:00:00.000 (1000000)|SOQL_EXECUTE_BEGIN|[3]|SELECT Id FROM User',
        '10:00:00.000 (3000000)|SOQL_EXECUTE_END|[3]|Rows:7',
        '10:00:00.000 (4000000)|SOQL_EXECUTE_BEGIN|[8]|SELECT Id FROM User',
        ''
      ].join('\n')
    )
    expect(summarizeLog(old).soql).toEqual([
      {
        query: 'SELECT Id FROM User',
        count: 2,
        rows: 7,
        timeMs: 2,
        lines: [1, 3],
        // Two different source lines: not a loop.
        possibleLoop: false
      }
    ])
  })
})

describe('summarizeLog: DML', () => {
  it('groups DML by operation and object', () => {
    expect(summary.dmlCount).toBe(3)
    expect(summary.dml).toEqual([
      {
        operation: 'Insert',
        object: 'Account',
        count: 1,
        rows: 2,
        timeMs: 10,
        lines: [lineOf(/Op:Insert/).number],
        possibleLoop: false
      },
      {
        operation: 'Update',
        object: 'Contact',
        count: 2,
        rows: 6,
        timeMs: 5,
        lines: lines.filter(l => /Op:Update/.test(l.text)).map(l => l.number),
        possibleLoop: true
      }
    ])
  })
})

describe('summarizeLog: performance', () => {
  it('summarizes a log with 200,000 entries quickly', () => {
    const big = ['62.0 APEX_CODE,DEBUG']
    for (let i = 0; i < 50000; i++) {
      big.push(
        `10:00:00.000 (${i * 4})|USER_DEBUG|[1]|DEBUG|line ${i}`,
        `10:00:00.000 (${i * 4 + 1})|SOQL_EXECUTE_BEGIN|[2]|Aggregations:0|SELECT Id FROM Account`,
        `10:00:00.000 (${i * 4 + 2})|SOQL_EXECUTE_END|[2]|Rows:1`,
        `10:00:00.000 (${i * 4 + 3})|METHOD_ENTRY|[3]|Foo.bar()`
      )
    }
    const bigLines = buildLines(big.join('\n'))
    const start = performance.now()
    const s = summarizeLog(bigLines)
    expect(performance.now() - start).toBeLessThan(1000)
    expect(s.soql[0]).toMatchObject({ count: 50000, rows: 50000 })
  })
})

describe('limitLevel', () => {
  it('turns amber at 70 % and red at 90 %', () => {
    expect(limitLevel(0, 100)).toBe('ok')
    expect(limitLevel(69, 100)).toBe('ok')
    expect(limitLevel(70, 100)).toBe('warning')
    expect(limitLevel(90, 100)).toBe('critical')
    expect(limitLevel(5, 0)).toBe('ok')
  })
})

describe('sortGroups', () => {
  const groups = summary.soql
  it('sorts by count, rows or time, keeping log order for ties', () => {
    expect(sortGroups(groups, 'count').map(g => g.count)).toEqual([3, 1])
    expect(sortGroups(groups, 'count', 'asc').map(g => g.count)).toEqual([1, 3])
    expect(sortGroups(groups, 'timeMs').map(g => g.timeMs)).toEqual([10, 4.5])
    expect(sortGroups(groups, 'rows').map(g => g.rows)).toEqual([5, 1])
  })
})

describe('nextOccurrence', () => {
  it('goes to the next line after the current one, wrapping around', () => {
    expect(nextOccurrence([4, 8, 12], -1)).toBe(4)
    expect(nextOccurrence([4, 8, 12], 4)).toBe(8)
    expect(nextOccurrence([4, 8, 12], 9)).toBe(12)
    expect(nextOccurrence([4, 8, 12], 12)).toBe(4)
    expect(nextOccurrence([], 3)).toBe(-1)
  })
})

describe('rowOfLine', () => {
  it('finds a line among the visible lines', () => {
    const visible = lines.filter(l => l.number % 2 === 0)
    expect(rowOfLine(visible, 4)).toBe(2)
    expect(rowOfLine(visible, 0)).toBe(0)
    expect(rowOfLine(visible, 3)).toBe(-1)
    expect(rowOfLine([], 3)).toBe(-1)
  })
})

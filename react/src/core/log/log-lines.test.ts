import { describe, expect, it } from 'vitest'
import log from './__fixtures__/anonymous-apex.log?raw'
import {
  buildLines,
  categoryCounts,
  findMatches,
  isDebugLine,
  isErrorLine,
  nextRow,
  segments,
  visibleLines
} from './log-lines'

const lines = buildLines(log)

describe('buildLines', () => {
  it('has the header, then one line per entry with its category', () => {
    expect(lines[0]).toMatchObject({
      number: 0,
      eventType: null,
      category: 'system'
    })
    expect(lines[0].text).toMatch(/^62\.0 APEX_CODE/)
    expect(lines[1]).toMatchObject({
      number: 1,
      eventType: 'USER_INFO',
      category: 'rest'
    })
    expect(lines.find(l => l.eventType === 'SOQL_EXECUTE_BEGIN').category).toBe(
      'soql'
    )
    expect(lines.at(-1).eventType).toBe('EXECUTION_FINISHED')
  })

  it('is empty without a body', () => {
    expect(buildLines('')).toEqual([])
  })
})

describe('categories', () => {
  it('counts entries per category', () => {
    const counts = categoryCounts(lines)
    expect(counts.debug).toBe(3)
    expect(counts.soql).toBe(2)
    expect(counts.system).toBe(2)
    expect(counts.error).toBe(0)
    expect(Object.values(counts).reduce((a, b) => a + b)).toBe(lines.length - 1)
  })

  it('hides categories but keeps the header and line numbers', () => {
    const shown = visibleLines(lines, ['system', 'rest', 'method'])
    expect(shown[0].number).toBe(0)
    expect(
      shown.slice(1).every(l => ['debug', 'soql'].includes(l.category))
    ).toBe(true)
    expect(shown.map(l => l.number)).toEqual([0, 4, 5, 6, 7, 8])
    expect(visibleLines(lines, [])).toBe(lines)
  })
})

describe('findMatches', () => {
  it('finds every occurrence, ignoring case', () => {
    const matches = findMatches(lines, 'e2e_marker')
    // Once in the header (the source) and once in the JSON debug line.
    expect(matches).toEqual([
      { row: 0, nth: 0 },
      { row: 7, nth: 0 }
    ])
    expect(findMatches(lines, 'account').filter(m => m.row === 0)).toHaveLength(
      4
    )
  })

  it('finds nothing for an empty term and stops at the limit', () => {
    expect(findMatches(lines, '')).toEqual([])
    expect(findMatches(lines, '|', 5)).toHaveLength(5)
  })
})

describe('nextRow', () => {
  it('moves to the next debug line and wraps around', () => {
    const first = nextRow(lines, 0, 1, isDebugLine)
    expect(lines[first].eventType).toBe('USER_DEBUG')
    expect(nextRow(lines, lines.length - 1, 1, isDebugLine)).toBe(first)
    expect(nextRow(lines, first, -1, isDebugLine)).toBe(first + 2)
  })

  it('returns -1 when no line matches', () => {
    expect(nextRow(lines, 0, 1, isErrorLine)).toBe(-1)
  })
})

describe('segments', () => {
  const line =
    '12:01:02.131 (9345678)|USER_DEBUG|[2]|DEBUG|Id=001Hn00001XyZabIAF, Name=Acme'

  it('splits the time, the event type and the message, keeping all text', () => {
    const parts = segments(line)
    expect(parts.map(p => p.text).join('')).toBe(line)
    expect(parts[0]).toEqual({ text: '12:01:02.131 (9345678)|', part: 'time' })
    expect(parts[1]).toEqual({ text: 'USER_DEBUG', part: 'event' })
    expect(parts.find(p => p.id)).toEqual({
      text: '001Hn00001XyZabIAF',
      part: 'message',
      id: '001Hn00001XyZabIAF'
    })
  })

  it('marks find matches, also inside ids, ignoring case', () => {
    const parts = segments(line, 'xyzab')
    expect(parts.map(p => p.text).join('')).toBe(line)
    const marked = parts.filter(p => p.match !== undefined)
    expect(marked).toEqual([
      { text: 'XyZab', part: 'message', id: '001Hn00001XyZabIAF', match: 0 }
    ])
    expect(
      parts
        .filter(p => p.id)
        .map(p => p.text)
        .join('')
    ).toBe('001Hn00001XyZabIAF')
  })

  it('numbers several matches in one line', () => {
    const parts = segments('abc abc', 'ABC')
    expect(parts).toEqual([
      { text: 'abc', part: 'message', match: 0 },
      { text: ' ', part: 'message' },
      { text: 'abc', part: 'message', match: 1 }
    ])
  })

  it('treats a header line as message only', () => {
    expect(segments('62.0 APEX_CODE,FINEST')).toEqual([
      { text: '62.0 APEX_CODE,FINEST', part: 'message' }
    ])
  })
})

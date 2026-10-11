import { describe, it, expect, vi, afterEach } from 'vitest'
import anonymousApexLog from './__fixtures__/anonymous-apex.log?raw'
import {
  splitLog,
  eventTypeOf,
  filterEntries,
  eventCategory,
  splitIds,
  splitUserDebug,
  indentUserDebug,
  canBeautify,
  beautifyUserDebug,
  isJsonString,
  sfdcObjectBeautify,
  looksLikeSfdcObject,
  looksLikeHtml
} from './parsing'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('splitLog', () => {
  const { intro, entries } = splitLog(anonymousApexLog)

  it('returns the header lines before the first entry as the intro', () => {
    expect(intro).toMatch(/^62\.0 APEX_CODE,FINEST;/)
    expect(intro).toContain('Execute Anonymous: System.debug(accounts);')
    expect(intro).not.toMatch(/\d\d:\d\d:\d\d\.\d+ \(\d+\)\|/)
  })

  it('splits the rest into one entry per timestamped event', () => {
    expect(entries.map(eventTypeOf)).toEqual([
      'USER_INFO',
      'EXECUTION_STARTED',
      'CODE_UNIT_STARTED',
      'SOQL_EXECUTE_BEGIN',
      'SOQL_EXECUTE_END',
      'USER_DEBUG',
      'USER_DEBUG',
      'USER_DEBUG',
      'SYSTEM_METHOD_ENTRY',
      'SYSTEM_METHOD_EXIT',
      'CUMULATIVE_LIMIT_USAGE',
      'LIMIT_USAGE_FOR_NS',
      'CUMULATIVE_LIMIT_USAGE_END',
      'CODE_UNIT_FINISHED',
      'EXECUTION_FINISHED'
    ])
  })

  it('keeps the last entry (regression: it used to be dropped)', () => {
    expect(entries[entries.length - 1]).toBe(
      '12:01:02.142 (18000000)|EXECUTION_FINISHED\n'
    )
  })

  it('keeps the last entry when the log has no trailing newline', () => {
    const { entries } = splitLog(anonymousApexLog.trimEnd())
    expect(entries[entries.length - 1]).toBe(
      '12:01:02.142 (18000000)|EXECUTION_FINISHED'
    )
  })

  it('keeps continuation lines with their entry', () => {
    expect(entries[7]).toBe(
      '12:01:02.132 (9545678)|USER_DEBUG|[4]|INFO|first line\nsecond line of the same message\n'
    )
    expect(entries[11]).toContain('Number of query rows: 2 out of 50000')
  })

  it('loses no text', () => {
    expect(intro + entries.join('')).toBe(anonymousApexLog)
  })

  it('returns no entries for a log without events', () => {
    expect(splitLog('62.0 APEX_CODE,DEBUG\n')).toEqual({
      intro: null,
      entries: []
    })
  })
})

describe('eventTypeOf', () => {
  it('reads the event type after the timestamp', () => {
    expect(
      eventTypeOf(
        '12:01:02.124 (2345678)|SOQL_EXECUTE_BEGIN|[1]|Aggregations:0|'
      )
    ).toBe('SOQL_EXECUTE_BEGIN')
  })

  it('returns null for text that is not an entry', () => {
    expect(eventTypeOf('Execute Anonymous: System.debug(1);')).toBeNull()
  })
})

describe('filterEntries', () => {
  const { entries } = splitLog(anonymousApexLog)

  it('keeps every entry when no event types are selected', () => {
    expect(filterEntries(entries, [])).toBe(entries)
  })

  it('keeps only the selected event types', () => {
    const kept = filterEntries(entries, ['USER_DEBUG', 'SOQL_EXECUTE_END'])
    expect(kept.map(eventTypeOf)).toEqual([
      'SOQL_EXECUTE_END',
      'USER_DEBUG',
      'USER_DEBUG',
      'USER_DEBUG'
    ])
  })

  it('drops entries without an event type', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(filterEntries(['not an entry'], ['USER_DEBUG'])).toEqual([])
    expect(error).toHaveBeenCalled()
  })
})

describe('eventCategory', () => {
  it.each([
    ['USER_DEBUG', 'debug'],
    ['SOQL_EXECUTE_BEGIN', 'soql'],
    ['METHOD_ENTRY', 'method'],
    ['CONSTRUCTOR_ENTRY', 'method'],
    ['CODE_UNIT_STARTED', 'method'],
    ['VALIDATION_RULE', 'method'],
    ['SYSTEM_METHOD_ENTRY', 'system'],
    ['ENTERING_MANAGED_PKG', 'system'],
    ['EXCEPTION_THROWN', 'error'],
    ['FATAL_ERROR', 'error'],
    ['CALLOUT_REQUEST', 'callout'],
    ['EXECUTION_STARTED', 'rest'],
    ['DML_BEGIN', 'rest'],
    ['HEAP_ALLOCATE', 'rest'],
    ['USER_INFO', 'rest']
  ])('%s -> %s', (eventType, category) => {
    expect(eventCategory(eventType)).toBe(category)
  })
})

describe('splitIds', () => {
  it('splits out ids and keeps the text after the last id', () => {
    expect(
      splitIds(
        '12:01:02.123 (1234567)|USER_INFO|[EXTERNAL]|005Hn00000ABCDEIA3|admin@example.com|GMT+02:00\n'
      )
    ).toEqual([
      '12:01:02.123 (1234567)|USER_INFO|[EXTERNAL]|',
      { id: '005Hn00000ABCDEIA3' },
      '|admin@example.com|GMT+02:00\n'
    ])
  })

  it('finds 15- and 18-character ids', () => {
    expect(splitIds('Id=001Hn00001XyZab, OwnerId=005Hn00000ABCDEIA3}')).toEqual(
      [
        'Id=',
        { id: '001Hn00001XyZab' },
        ', OwnerId=',
        { id: '005Hn00000ABCDEIA3' },
        '}'
      ]
    )
    expect(splitIds('005000000000001AAA and 001000000000001')).toEqual([
      { id: '005000000000001AAA' },
      ' and ',
      { id: '001000000000001' }
    ])
  })

  it('skips words that only look like ids (m7)', () => {
    // Part of a username, and 18/15-character words that aren't ids.
    expect(splitIds('user@00d1i000002wltfua2.example.com')).toEqual([
      'user@00d1i000002wltfua2.example.com'
    ])
    expect(splitIds('ABCDEFGHIJKLMNOPQR abcdefghijklmno')).toEqual([
      'ABCDEFGHIJKLMNOPQR abcdefghijklmno'
    ])
  })

  it('returns the whole text when there is no id', () => {
    expect(splitIds('12:01:02.123 (1245678)|EXECUTION_STARTED\n')).toEqual([
      '12:01:02.123 (1245678)|EXECUTION_STARTED\n'
    ])
  })
})

describe('splitUserDebug', () => {
  it('splits a USER_DEBUG entry into header and message', () => {
    expect(
      splitUserDebug(
        '12:01:02.132 (9545678)|USER_DEBUG|[4]|INFO|first line\nsecond line\n'
      )
    ).toEqual({
      header: '12:01:02.132 (9545678)|USER_DEBUG|[4]|INFO|',
      message: 'first line\nsecond line\n'
    })
  })

  it('splits a line shown without its timestamp, at the first level', () => {
    expect(splitUserDebug('USER_DEBUG|[3]|DEBUG|a |DEBUG| b')).toEqual({
      header: 'USER_DEBUG|[3]|DEBUG|',
      message: 'a |DEBUG| b'
    })
  })

  it('returns null for other text', () => {
    expect(splitUserDebug('no level')).toBeNull()
    expect(
      splitUserDebug(
        '12:01:02.133 (9645678)|SYSTEM_METHOD_ENTRY|[5]|System.debug(ANY)'
      )
    ).toBeNull()
  })
})

describe('indentUserDebug', () => {
  it('pretty-prints a JSON message and keeps the header', () => {
    expect(
      indentUserDebug(
        '12:01:02.131 (9445678)|USER_DEBUG|[3]|DEBUG|{"marker":"E2E_MARKER_1","ids":[1,2]}\n'
      )
    ).toBe(
      '12:01:02.131 (9445678)|USER_DEBUG|[3]|DEBUG|{\n  "marker": "E2E_MARKER_1",\n  "ids": [1, 2]\n}'
    )
  })

  it('pretty-prints a list of Apex objects', () => {
    expect(
      indentUserDebug(
        '12:01:02.131 (9345678)|USER_DEBUG|[2]|DEBUG|(Account:{Id=001Hn00001XyZabIAF, Name=Acme}, Account:{Id=001Hn00001XyZacIAF, Name=Globex})\n'
      )
    ).toBe(
      [
        '12:01:02.131 (9345678)|USER_DEBUG|[2]|DEBUG|(Account: {',
        "    Id: '001Hn00001XyZabIAF',",
        "    Name: 'Acme'",
        '}, Account: {',
        "    Id: '001Hn00001XyZacIAF',",
        "    Name: 'Globex'",
        '})'
      ].join('\n')
    )
  })

  it('leaves plain text and other events unchanged', () => {
    const plain = '12:01:02.132 (9545678)|USER_DEBUG|[4]|INFO|first line\n'
    expect(indentUserDebug(plain)).toBe(plain)
    const other = '12:01:02.142 (18000000)|EXECUTION_FINISHED\n'
    expect(indentUserDebug(other)).toBe(other)
  })
})

describe('beautifyUserDebug', () => {
  it('indents HTML', () => {
    expect(beautifyUserDebug('<div><p>Hello</p></div>')).toBe(
      '<div>\n    <p>Hello</p>\n</div>'
    )
  })

  it('keeps JSON numbers and keys exactly as logged', () => {
    expect(beautifyUserDebug('{"id":12345678901234567890,"a":1,"a":2}')).toBe(
      '{\n  "id": 12345678901234567890,\n  "a": 1,\n  "a": 2\n}'
    )
  })

  it('returns other text unchanged', () => {
    expect(beautifyUserDebug('E2E_MARKER_1700000000000')).toBe(
      'E2E_MARKER_1700000000000'
    )
  })
})

describe('canBeautify', () => {
  it.each([
    ['<div>x</div>', true],
    ['{"a":1}', true],
    ['Account:{Id=001Hn00001XyZabIAF}', true],
    ['first line', false]
  ])('%s -> %s', (text, expected) => {
    expect(canBeautify(text)).toBe(expected)
  })
})

describe('isJsonString', () => {
  it.each([
    ['{"a":1}', true],
    ['[1,2]', true],
    ['42', true],
    ['Account:{Id=001Hn00001XyZabIAF}', false],
    ['first line', false]
  ])('%s -> %s', (text, expected) => {
    expect(isJsonString(text)).toBe(expected)
  })
})

describe('looksLikeSfdcObject', () => {
  it('matches an Apex object toString()', () => {
    expect(
      looksLikeSfdcObject('Account:{Id=001Hn00001XyZabIAF, Name=Acme}')
    ).toBeTruthy()
    expect(
      looksLikeSfdcObject('(Contact:{LastName=Doe}, Contact:{LastName=Roe})')
    ).toBeTruthy()
  })

  it('does not match JSON or plain text', () => {
    expect(looksLikeSfdcObject('{"Id":"001Hn00001XyZabIAF"}')).toBeFalsy()
    expect(looksLikeSfdcObject('Number of SOQL queries: 1')).toBeFalsy()
  })
})

describe('sfdcObjectBeautify', () => {
  it('turns fields into quoted object literal properties', () => {
    expect(
      sfdcObjectBeautify(
        '(Account:{Id=001Hn00001XyZabIAF, Name=Acme}, Account:{Id=001Hn00001XyZacIAF, Name=Globex})'
      )
    ).toBe(
      "(Account:{Id:'001Hn00001XyZabIAF', Name:'Acme'}, Account:{Id:'001Hn00001XyZacIAF', Name:'Globex'})"
    )
  })

  it('handles nested objects', () => {
    expect(
      sfdcObjectBeautify(
        '(Contact:{LastName=Doe, Account={Name=Acme}, Title=CEO})'
      )
    ).toBe("(Contact:{LastName:'Doe', Account:{Name:'Acme'}, Title:'CEO'})")
  })
})

describe('looksLikeHtml', () => {
  it('detects markup after leading whitespace', () => {
    expect(looksLikeHtml('\n  <div>x</div>')).toBe(true)
    expect(looksLikeHtml('x < y')).toBe(false)
    expect(looksLikeHtml('   ')).toBeFalsy()
  })
})

import { describe, expect, it } from 'vitest'
import { logToBlocks } from './classic-blocks'

const log = [
  '62.0 APEX_CODE,FINEST',
  'Execute Anonymous: System.debug(\'<img src=x onerror="alert(1)">\');',
  '12:00:00.1 (100)|USER_DEBUG|[1]|DEBUG|<img src=x onerror="alert(1)">',
  'second line of the message',
  '12:00:00.2 (200)|SOQL_EXECUTE_BEGIN|[2]|Aggregations:0|SELECT Id FROM User',
  '12:00:00.3 (300)|HEAP_ALLOCATE|[72]|Bytes:3',
  '12:00:00.4 (400)|METHOD_ENTRY|[1]|01p000000000001|Foo.bar()',
  '12:00:00.5 (500)|SYSTEM_METHOD_ENTRY|[2]|System.debug(ANY)',
  '12:00:00.6 (600)|FATAL_ERROR|System.MathException: Divide by 0',
  '12:00:00.7 (700)|CALLOUT_REQUEST|[3]|System.HttpRequest',
  '12:00:00.8 (800)|CUMULATIVE_LIMIT_USAGE',
  '  Number of SOQL queries: 1 out of 100'
].join('\n')

describe('logToBlocks', () => {
  it('wraps the header and classes each entry', () => {
    const blocks = logToBlocks(log, false)
    expect(blocks.map(b => b.className)).toEqual([
      'rest',
      'system searchable',
      'debug',
      'soql searchable wrap',
      'rest searchable',
      'method methodLog searchable',
      'system systemMethodLog searchable',
      'err searchable',
      'callout searchable',
      'rest searchable'
    ])
  })

  it('keeps markup as plain text and appends continuation lines', () => {
    const debug = logToBlocks(log, false)[2]
    expect(debug.parts.join('')).toBe(
      'USER_DEBUG|[1]|DEBUG|<img src=x onerror="alert(1)">\nsecond line of the message'
    )
  })

  it('keeps the timestamp when asked', () => {
    expect(logToBlocks(log, true)[2].parts[0]).toBe(
      '12:00:00.1 (100)|USER_DEBUG|[1]|DEBUG|<img src=x onerror="alert(1)">'
    )
  })
})

it('appends lines without an event to the entry before', () => {
  const last = logToBlocks(log, true).pop()
  expect(last.parts.join('')).toBe(
    '12:00:00.8 (800)|CUMULATIVE_LIMIT_USAGE\n  Number of SOQL queries: 1 out of 100'
  )
})

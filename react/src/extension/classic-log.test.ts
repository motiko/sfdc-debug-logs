import { describe, expect, it } from 'vitest'
import { logToBlocks, splitIds, splitUserDebug } from './classic-log'

const log = [
  '62.0 APEX_CODE,FINEST',
  'Execute Anonymous: System.debug(\'<img src=x onerror="alert(1)">\');',
  '12:00:00.1 (100)|USER_DEBUG|[1]|DEBUG|<img src=x onerror="alert(1)">',
  'second line of the message',
  '12:00:00.2 (200)|SOQL_EXECUTE_BEGIN|[2]|Aggregations:0|SELECT Id FROM User',
  '12:00:00.3 (300)|HEAP_ALLOCATE|[72]|Bytes:3'
].join('\n')

describe('logToBlocks', () => {
  it('wraps the header and classes each entry', () => {
    const blocks = logToBlocks(log, false)
    expect(blocks.map(b => b.className)).toEqual([
      'rest',
      'system searchable',
      'debug',
      'soql searchable wrap',
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

describe('splitIds', () => {
  it('splits out 15 and 18 character ids', () => {
    expect(splitIds('user 005000000000001AAA and 001000000000001')).toEqual([
      'user ',
      { id: '005000000000001AAA' },
      ' and ',
      { id: '001000000000001' }
    ])
  })
})

describe('splitUserDebug', () => {
  it('splits at the first level marker and keeps the rest of the message', () => {
    expect(splitUserDebug('USER_DEBUG|[3]|DEBUG|a |DEBUG| b')).toEqual({
      header: 'USER_DEBUG|[3]|DEBUG|',
      message: 'a |DEBUG| b'
    })
    expect(splitUserDebug('no level')).toBeNull()
  })
})

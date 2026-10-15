import { describe, expect, it } from 'vitest'
import { fileOperation, fileTimestamp, logFileName } from './download'

describe('fileTimestamp', () => {
  it('formats a Salesforce StartTime in UTC without colons', () => {
    expect(fileTimestamp('2026-10-12T08:15:30.000+0000')).toBe(
      '2026-10-12T08-15-30Z'
    )
    expect(fileTimestamp('2026-10-12T10:15:30.000+0200')).toBe(
      '2026-10-12T08-15-30Z'
    )
    expect(fileTimestamp('2026-10-12T08:15:30.000Z')).toBe(
      '2026-10-12T08-15-30Z'
    )
  })

  it('is empty for a missing or invalid time', () => {
    expect(fileTimestamp(undefined)).toBe('')
    expect(fileTimestamp('')).toBe('')
    expect(fileTimestamp('yesterday')).toBe('')
  })
})

describe('fileOperation', () => {
  it('keeps the last part of a page path', () => {
    expect(fileOperation('/apex/MyPage')).toBe('MyPage')
    expect(fileOperation('/services/data/v62.0/tooling/executeAnonymous')).toBe(
      'executeAnonymous'
    )
    expect(fileOperation('executeAnonymous')).toBe('executeAnonymous')
  })

  it('replaces characters that are unsafe in file names', () => {
    expect(fileOperation('Batch Apex: MyJob<1>')).toBe('Batch-Apex-MyJob-1')
    expect(fileOperation('..')).toBe('')
    expect(fileOperation('a'.repeat(60))).toHaveLength(40)
    expect(fileOperation(undefined)).toBe('')
  })
})

describe('logFileName', () => {
  it('names the file by start time, operation and id', () => {
    expect(
      logFileName({
        id: '07LMK0000000001AAA',
        startTime: '2026-10-12T08:15:30.000+0000',
        operation: 'executeAnonymous'
      })
    ).toBe('2026-10-12T08-15-30Z_executeAnonymous_07LMK0000000001AAA.log')
  })

  it('leaves out what is not known', () => {
    expect(logFileName({ id: '07LMK0000000001AAA' })).toBe(
      '07LMK0000000001AAA.log'
    )
    expect(
      logFileName({ id: '07LMK0000000001AAA', operation: '/apex/Page' })
    ).toBe('Page_07LMK0000000001AAA.log')
  })

  it('never puts path characters from the id in the name', () => {
    expect(logFileName({ id: '../07L' })).toBe('07L.log')
    expect(logFileName({ id: '' })).toBe('apex-log.log')
  })
})

import { describe, it, expect } from 'vitest'
import { logHash, logIdFromHash } from './hash-route'

describe('hash routes', () => {
  it('reads the log id of #/logs/<id>', () => {
    expect(logIdFromHash('#/logs/07L000000000001AAA')).toBe(
      '07L000000000001AAA'
    )
    expect(logIdFromHash('/logs/07L000000000001AAA')).toBe('07L000000000001AAA')
  })

  it('shows the log list for any other hash', () => {
    for (const hash of ['', '#', '#/', '#/logs', '#/logs/', '#/other/1']) {
      expect(logIdFromHash(hash)).toBe(null)
    }
  })

  it('builds the hashes it reads', () => {
    expect(logHash('07L000000000001AAA')).toBe('#/logs/07L000000000001AAA')
    expect(logIdFromHash(logHash('07L000000000001AAA'))).toBe(
      '07L000000000001AAA'
    )
    expect(logHash(null)).toBe('#/')
  })
})

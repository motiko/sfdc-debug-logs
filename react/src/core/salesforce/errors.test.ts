import { describe, expect, it } from 'vitest'
import { explainError } from './errors'
import { SalesforceError } from './request'

describe('explainError', () => {
  it('explains an expired session', () => {
    const e = explainError(
      new SalesforceError(401, 'Unauthorized'),
      'acme.my.salesforce.com'
    )
    expect(e.kind).toBe('session')
    expect(e.hint).toContain('acme.my.salesforce.com')
    expect(e.detail).toBe('401: Unauthorized')
  })

  it('explains missing permissions', () => {
    expect(explainError(new SalesforceError(403, 'Forbidden')).kind).toBe(
      'permission'
    )
  })

  it('explains an unreachable org', () => {
    const e = explainError(new TypeError('Failed to fetch'), 'x.invalid')
    expect(e).toMatchObject({
      kind: 'network',
      title: "Can't reach x.invalid."
    })
  })

  it('keeps other errors with their message', () => {
    const e = explainError(new SalesforceError(500, 'Server Error', 'boom'))
    expect(e.kind).toBe('other')
    expect(e.detail).toBe('500: Server Error (boom)')
    expect(explainError(undefined).detail).toBe('Unknown error')
  })
})

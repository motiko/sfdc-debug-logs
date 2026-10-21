import { describe, expect, it } from 'vitest'
import { apiHostFor, isOrgHost, pickSessionCookie } from './org-hosts'

describe('isOrgHost', () => {
  it('accepts My Domain, Lightning, Setup and classic instance hosts', () => {
    for (const host of [
      'acme.my.salesforce.com',
      'acme.lightning.force.com',
      'acme.my.salesforce-setup.com',
      'na42.salesforce.com',
      'eu5.salesforce.com'
    ]) {
      expect(isOrgHost(host), host).toBe(true)
    }
  })

  it('rejects public Sites and other hosts', () => {
    for (const host of [
      'someone.force.com',
      'someone.my.site.com',
      'login.salesforce.com',
      'evil.example.com',
      'acme.my.salesforce.com.evil.example.com'
    ]) {
      expect(isOrgHost(host), host).toBe(false)
    }
  })
})

describe('apiHostFor', () => {
  it('maps Lightning and Setup hosts to the My Domain API host', () => {
    expect(apiHostFor('acme.lightning.force.com')).toBe(
      'acme.my.salesforce.com'
    )
    expect(apiHostFor('acme.my.salesforce-setup.com')).toBe(
      'acme.my.salesforce.com'
    )
  })

  it('leaves other hosts unchanged', () => {
    expect(apiHostFor('acme.my.salesforce.com')).toBe('acme.my.salesforce.com')
    expect(apiHostFor('na42.salesforce.com')).toBe('na42.salesforce.com')
  })
})

describe('pickSessionCookie', () => {
  const cookies = [
    { domain: 'acme.lightning.force.com', value: '00D1I000002wLTF!lightning' },
    { domain: 'acme.my.salesforce.com', value: '00D1I000002wLTF!api' },
    { domain: 'other.my.salesforce.com', value: '00D2I000002wXYZ!other' }
  ]

  it('prefers the cookie of the API host', () => {
    expect(
      pickSessionCookie(cookies, { apiHost: 'acme.my.salesforce.com' })
    ).toEqual({ token: '00D1I000002wLTF!api', host: 'acme.my.salesforce.com' })
  })

  it('falls back to a My Domain cookie of the same org', () => {
    expect(
      pickSessionCookie(cookies, {
        apiHost: 'acme.my.salesforce.mil',
        orgId: '00D1I000002wLTFEAU'
      })
    ).toEqual({ token: '00D1I000002wLTF!api', host: 'acme.my.salesforce.com' })
  })

  it('never returns a Lightning cookie or another org', () => {
    expect(
      pickSessionCookie(cookies.slice(0, 1), {
        apiHost: 'acme.my.salesforce.com',
        orgId: '00D1I000002wLTF'
      })
    ).toBeUndefined()
    expect(
      pickSessionCookie(cookies, {
        apiHost: 'acme.my.salesforce.mil',
        orgId: '00D3I000002wAAA'
      })
    ).toBeUndefined()
  })
})

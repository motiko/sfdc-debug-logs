import { describe, expect, it } from 'vitest'
import { apiHostFor, isOrgHost } from './org-hosts'

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

import { describe, expect, it } from 'vitest'
import { appPageUrl, appTabName, parseDisco } from './app-tab'

describe('app tab', () => {
  it('names the tab after the org', () => {
    expect(appTabName('00DMK0000000001')).toBe('app_00DMK0000000001')
  })

  it('builds the app URL with an encoded session and host', () => {
    const url = appPageUrl(
      'chrome-extension://id/html/app.html',
      { orgId: '00D1', userId: '0051' },
      { token: '00D1!a/b+c', host: 'acme.my.salesforce.com' }
    )
    const params = new URL(url).searchParams
    expect(params.get('oid')).toBe('00D1')
    expect(params.get('uid')).toBe('0051')
    expect(params.get('sid')).toBe('00D1!a/b+c')
    expect(params.get('host')).toBe('acme.my.salesforce.com')
  })

  it('reads the org and user ids from the disco cookie', () => {
    expect(parseDisco('5:00DMK0000000001:005MK0000000001:0:host')).toEqual({
      orgId: '00DMK0000000001',
      userId: '005MK0000000001'
    })
    expect(parseDisco(null)).toEqual({ orgId: undefined, userId: undefined })
    expect(parseDisco('garbage')).toEqual({
      orgId: undefined,
      userId: undefined
    })
  })
})

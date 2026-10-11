import { describe, expect, it, vi } from 'vitest'
import { createRequest, SalesforceError } from './request'

function response(status: number, body = '', type = 'application/json') {
  return new Response(status === 204 ? null : body, {
    status,
    statusText: {
      200: 'OK',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized'
    }[status],
    headers: { 'Content-Type': type }
  })
}

const initOf = (fetch: { mock: { calls: any[][] } }, i: number) =>
  fetch.mock.calls[i][1]

describe('createRequest', () => {
  it('sends the token to the origin and parses JSON', async () => {
    const fetch = vi.fn(async (..._args: any[]) => response(200, '{"a":1}'))
    const request = createRequest({
      origin: 'https://acme.my.salesforce.com',
      token: 'T1',
      getToken: async () => 'unused',
      fetch
    })
    expect(await request('/services/data/v62.0/sobjects')).toEqual({ a: 1 })
    expect(fetch).toHaveBeenCalledWith(
      'https://acme.my.salesforce.com/services/data/v62.0/sobjects',
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer T1' },
        body: undefined
      }
    )
  })

  it('gets the token lazily and only once', async () => {
    const getToken = vi.fn(async (..._args: any[]) => 'T2')
    const fetch = vi.fn(async (..._args: any[]) => response(204))
    const request = createRequest({ origin: '', getToken, fetch })
    expect(await request('/a', { method: 'DELETE' })).toBeNull()
    await request('/b')
    expect(getToken).toHaveBeenCalledTimes(1)
  })

  it('sends objects as JSON and strings as they are', async () => {
    const fetch = vi.fn(async (..._args: any[]) =>
      response(200, 'plain', 'text/plain')
    )
    const request = createRequest({
      origin: '',
      token: 'T',
      getToken: null,
      fetch
    })
    expect(await request('/json', { method: 'POST', body: { x: 1 } })).toBe(
      'plain'
    )
    await request('/csv', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/csv' },
      body: 'Id\n1'
    })
    expect(initOf(fetch, 0)).toMatchObject({
      body: '{"x":1}',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    })
    expect(initOf(fetch, 1)).toMatchObject({
      body: 'Id\n1',
      headers: { 'Content-Type': 'text/csv' }
    })
  })

  it('reads text responses', async () => {
    const fetch = vi.fn(async (..._args: any[]) =>
      response(200, '{"not":"parsed"}')
    )
    const request = createRequest({
      origin: '',
      token: 'T',
      getToken: null,
      fetch
    })
    expect(await request('/body', { responseType: 'text' })).toBe(
      '{"not":"parsed"}'
    )
    expect(initOf(fetch, 0).headers.Accept).toBe('*/*')
  })

  it('renews the token once after a 401', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, '{"ok":true}'))
    const getToken = vi.fn(async (..._args: any[]) => 'NEW')
    const request = createRequest({ origin: '', token: 'OLD', getToken, fetch })
    expect(await request('/x')).toEqual({ ok: true })
    expect(
      fetch.mock.calls.map(([, init]) => init.headers.Authorization)
    ).toEqual(['Bearer OLD', 'Bearer NEW'])
  })

  it("throws Salesforce's error message with the status", async () => {
    const fetch = vi.fn(async (..._args: any[]) =>
      response(
        400,
        '[{"message":"LogType is required.","errorCode":"FIELD_INTEGRITY_EXCEPTION"}]'
      )
    )
    const request = createRequest({
      origin: '',
      token: 'T',
      getToken: null,
      fetch
    })
    const error = await request('/x').catch(e => e)
    expect(error).toBeInstanceOf(SalesforceError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('400: Bad Request (LogType is required.)')
  })
})

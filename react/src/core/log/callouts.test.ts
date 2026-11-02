import { describe, it, expect } from 'vitest'
import calloutsLog from './__fixtures__/callouts.log?raw'
import { eventTypeOf, splitLog } from './parsing'
import { eventCategory } from './categories'
import {
  beautifyCallout,
  canBeautifyCallout,
  parseApexRecord,
  splitCallout
} from './callouts'
import {
  canExpandValue,
  expandEntry,
  expandValue,
  isExpandable,
  splitValue
} from './values'

const { entries } = splitLog(calloutsLog)
const entry = (text: string) => {
  const found = entries.find(e => e.includes(text))
  if (!found) throw new Error(`no entry with ${text}`)
  return found
}

describe('splitCallout', () => {
  it('splits an HTTP request into its header and value', () => {
    expect(splitCallout(entry('CALLOUT_REQUEST|[5]|'))).toEqual({
      header: '10:15:02.12 (12784011)|CALLOUT_REQUEST|[5]|',
      message:
        'System.HttpRequest[Endpoint=https://api.example.com/v1/orders?status=open&limit=5, Method=POST]\n'
    })
  })

  it('works without the timestamp (classic page with timestamps off)', () => {
    expect(
      splitCallout('CALLOUT_RESPONSE|[5]|System.HttpResponse[Status=OK]')
    ).toEqual({
      header: 'CALLOUT_RESPONSE|[5]|',
      message: 'System.HttpResponse[Status=OK]'
    })
  })

  it('splits Named Credential entries, which have no source line', () => {
    const parsed = splitCallout(entry('NAMED_CREDENTIAL_REQUEST'))
    expect(parsed.header).toBe(
      '10:15:02.401 (401221014)|NAMED_CREDENTIAL_REQUEST|'
    )
    expect(parsed.message).toMatch(/^NamedCallout\[Named Credential Id=/)
  })

  it('returns null for other entries', () => {
    expect(splitCallout(entry('USER_DEBUG'))).toBeNull()
    expect(splitCallout(entry('CODE_UNIT_STARTED'))).toBeNull()
    expect(splitCallout('CALLOUT_REQUEST_LIMIT|x')).toBeNull()
  })

  it('callout entries are in the callout category', () => {
    for (const e of entries.filter(e => splitCallout(e))) {
      expect(eventCategory(eventTypeOf(e))).toBe('callout')
    }
  })
})

describe('parseApexRecord', () => {
  it('reads the type and fields of an HttpRequest', () => {
    expect(
      parseApexRecord(
        'System.HttpRequest[Endpoint=https://x.example.com/a?b=c, Method=GET]'
      )
    ).toEqual({
      type: 'System.HttpRequest',
      separator: '',
      fields: [
        ['Endpoint', 'https://x.example.com/a?b=c'],
        ['Method', 'GET']
      ],
      suffix: ''
    })
  })

  it('keeps keys with spaces and values with "=" or ", "', () => {
    const record = parseApexRecord(
      'NamedCallout[Status Code=200, Content-Type=text/html;charset=UTF-8, Accept=text/plain, text/html]'
    )
    expect(record.fields).toEqual([
      ['Status Code', '200'],
      ['Content-Type', 'text/html;charset=UTF-8'],
      ['Accept', 'text/plain, text/html']
    ])
  })

  it('keeps nested objects and lists in one field', () => {
    const record = parseApexRecord(
      'Svc.call_element:[order=Svc.Order:[id=1, n=2], info=(a, b)]'
    )
    expect(record.separator).toBe(':')
    expect(record.fields).toEqual([
      ['order', 'Svc.Order:[id=1, n=2]'],
      ['info', '(a, b)']
    ])
  })

  it('reads an empty object, and keeps text after it', () => {
    expect(parseApexRecord('System.HttpResponse[] (cached)')).toEqual({
      type: 'System.HttpResponse',
      separator: '',
      fields: [],
      suffix: ' (cached)'
    })
  })

  it('returns null for text that is not an object', () => {
    expect(parseApexRecord('{"a":1}')).toBeNull()
    expect(parseApexRecord('hello [world]')).toBeNull()
    expect(parseApexRecord('Thing[not a field]')).toBeNull()
  })
})

describe('beautifyCallout', () => {
  it('puts each field of a request on its own line', () => {
    expect(
      beautifyCallout(
        'System.HttpRequest[Endpoint=https://api.example.com/ping, Method=GET]\n'
      )
    ).toBe(
      'System.HttpRequest[\n  Endpoint=https://api.example.com/ping,\n  Method=GET\n]'
    )
  })

  it('indents nested objects', () => {
    expect(beautifyCallout(splitCallout(entry('[14]')).message)).toBe(
      [
        'OrderService.submitOrder_element:[',
        '  order=OrderService.Order:[',
        '    id=42,',
        '    lines=(1, 2, 3)',
        '  ],',
        '  apex_schema_type_info=(http://example.com/orders, true, false),',
        '  field_order_type_info=(order)',
        ']'
      ].join('\n')
    )
  })

  it('pretty-prints JSON in a field below its key', () => {
    expect(beautifyCallout('Req[Body={"a":1,"b":[1,2]}, Method=POST]')).toBe(
      'Req[\n  Body={\n    "a": 1,\n    "b": [1, 2]\n  },\n  Method=POST\n]'
    )
  })

  it('pretty-prints XML in a field below its key', () => {
    expect(beautifyCallout('Req[Body=<order><id>1</id></order>]')).toBe(
      'Req[\n  Body=<order>\n    <id>1</id>\n  </order>\n]'
    )
  })

  it('pretty-prints a JSON value', () => {
    expect(beautifyCallout(splitCallout(entry('accepted')).message)).toBe(
      '{\n  "status": "accepted",\n  "order": {\n    "id": 42,\n    "lines": [1, 2, 3]\n  }\n}'
    )
  })

  it('pretty-prints an XML value', () => {
    const pretty = beautifyCallout(splitCallout(entry('soapenv')).message)
    expect(pretty.split('\n')).toEqual([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
      '    <soapenv:Body>',
      '        <result>',
      '            <id>42</id>',
      '        </result>',
      '    </soapenv:Body>',
      '</soapenv:Envelope>'
    ])
  })

  it('returns other text unchanged', () => {
    expect(beautifyCallout('plain text')).toBe('plain text')
  })
})

describe('canBeautifyCallout', () => {
  it('is true for objects with three or more fields, JSON and XML', () => {
    expect(canBeautifyCallout('Req[Endpoint=https://x, Method=GET, a=1]')).toBe(
      true
    )
    expect(canBeautifyCallout('{"a":1}')).toBe(true)
    expect(canBeautifyCallout('<a>1</a>')).toBe(true)
    expect(canBeautifyCallout('Req[Body={"a":1}]')).toBe(true)
  })

  it('is false when expanding would change nothing', () => {
    expect(canBeautifyCallout('System.HttpResponse[Status=OK]')).toBe(false)
    expect(
      canBeautifyCallout('System.HttpResponse[Status=OK, StatusCode=200]')
    ).toBe(false)
    expect(
      canBeautifyCallout(
        'System.HttpRequest[Endpoint=https://api.example.com/ping, Method=GET]'
      )
    ).toBe(false)
    expect(canBeautifyCallout('System.HttpResponse[]')).toBe(false)
    expect(canBeautifyCallout('plain text')).toBe(false)
  })
})

describe('values (USER_DEBUG and callouts)', () => {
  it('splits USER_DEBUG and callout entries, and nothing else', () => {
    expect(splitValue(entry('USER_DEBUG')).kind).toBe('debug')
    expect(splitValue(entry('CALLOUT_RESPONSE|[5]')).kind).toBe('callout')
    expect(splitValue(entry('NAMED_CREDENTIAL_RESPONSE')).kind).toBe('callout')
    expect(splitValue(entry('EXECUTION_STARTED'))).toBeNull()
  })

  it('only callouts that expanding changes much can be expanded', () => {
    const callouts = entries.filter(e => splitCallout(e))
    expect(callouts).toHaveLength(10)
    const expandable = callouts.filter(isExpandable).map(e => {
      const { header } = splitCallout(e)
      return header.replace(/^[^|]*\|/, '')
    })
    // Named Credential entries (many fields), the nested SOAP object, the
    // JSON and the XML response; not the two-field HttpRequest/HttpResponse.
    expect(expandable).toEqual([
      'NAMED_CREDENTIAL_REQUEST|',
      'NAMED_CREDENTIAL_RESPONSE|',
      'CALLOUT_REQUEST|[14]|',
      'CALLOUT_RESPONSE|[14]|',
      'CALLOUT_RESPONSE|[17]|'
    ])
    expect(isExpandable(entry('EXECUTION_STARTED'))).toBe(false)
  })

  it('expandEntry keeps the header and pretty-prints the value', () => {
    expect(expandEntry(entry('CALLOUT_RESPONSE|[14]'))).toBe(
      '10:15:02.9 (900113562)|CALLOUT_RESPONSE|[14]|{\n  "status": "accepted",\n  "order": {\n    "id": 42,\n    "lines": [1, 2, 3]\n  }\n}'
    )
    expect(expandEntry(entry('USER_DEBUG'))).toMatch(
      /^10:15:02\.392 \(392011245\)\|USER_DEBUG\|\[6\]\|DEBUG\|\{\n {2}"orders"/
    )
    const other = entry('EXECUTION_STARTED')
    expect(expandEntry(other)).toBe(other)
  })

  it('canExpandValue and expandValue follow the kind', () => {
    expect(canExpandValue('debug', 'Req[a=1, b=2, c=3]')).toBe(false)
    expect(canExpandValue('callout', 'Req[a=1, b=2, c=3]')).toBe(true)
    expect(expandValue('debug', '{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('expanding keeps every non-space character of the value', () => {
    const squeeze = (s: string) => s.replace(/[\s,]/g, '')
    for (const e of entries.filter(e => splitCallout(e))) {
      const { message } = splitCallout(e)
      if (message.trimStart().startsWith('<')) continue // HTML whitespace
      expect(squeeze(beautifyCallout(message))).toBe(squeeze(message))
    }
  })
})

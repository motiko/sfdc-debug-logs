// Callout entries of a log: HTTP callouts (CALLOUT_REQUEST, CALLOUT_RESPONSE)
// and Named Credential callouts (NAMED_CREDENTIAL_REQUEST, _RESPONSE,
// _RESPONSE_DETAIL). Splits an entry into its header and its value, and
// pretty-prints the value: Salesforce logs the request and response objects
// as "System.HttpRequest[Endpoint=https://…, Method=POST]" (SOAP callouts as
// "Type:[field=value, …]"), shown expanded with one field per line; a field
// or a whole value holding JSON, XML or HTML is pretty-printed too.
//
// Plain text in, plain text out, like parsing.ts: the views never treat log
// text as HTML.
import jsBeautify from 'js-beautify'
import { beautifyUserDebug, canBeautify, isJsonString } from './parsing'

export const CALLOUT_EVENTS = [
  'CALLOUT_REQUEST',
  'CALLOUT_RESPONSE',
  'NAMED_CREDENTIAL_REQUEST',
  'NAMED_CREDENTIAL_RESPONSE',
  'NAMED_CREDENTIAL_RESPONSE_DETAIL'
] as const

// "12:01:02.123 (1234567)|" (optional), the event type, then the source line
// ("[12]|") if the event has one.
const calloutHeaderRegex = new RegExp(
  String.raw`^((?:\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|)?(?:` +
    CALLOUT_EVENTS.join('|') +
    String.raw`)\|(?:\[[^\]|\n]*\]\|)?)([^]*)`
)

// Splits a callout entry or line into its header ("…|CALLOUT_REQUEST|[12]|",
// with or without the timestamp) and the logged value, or returns null if it
// isn't one.
export function splitCallout(
  entry: string
): { header: string; message: string } | null {
  const parsed = calloutHeaderRegex.exec(entry)
  return parsed ? { header: parsed[1], message: parsed[2] } : null
}

// An Apex object as Salesforce logs it: "System.HttpRequest[Endpoint=…,
// Method=GET]" or "Port.method_element:[x=1, y=(a, b)]".
export interface ApexRecord {
  type: string
  // ":" between the type and "[" (SOAP objects), or "".
  separator: string
  fields: [key: string, value: string][]
  // Text after the closing "]" (kept as is).
  suffix: string
}

const OPEN = '([{'
const CLOSE = ')]}'

// The index of the bracket closing the one at `open`, or -1.
function closingBracket(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (OPEN.includes(text[i])) depth++
    else if (CLOSE.includes(text[i])) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Splits at ", " outside brackets.
function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (OPEN.includes(c)) depth++
    else if (CLOSE.includes(c)) depth = Math.max(0, depth - 1)
    else if (depth === 0 && c === ',' && text[i + 1] === ' ') {
      parts.push(text.slice(start, i))
      start = i + 2
      i++
    }
  }
  parts.push(text.slice(start))
  return parts
}

// "Key=value"; keys may have spaces ("Named Credential Id", "Status Code").
const fieldRegex = /^([A-Za-z_][\w .-]*?)=([^]*)$/

// Parses "Type[key=value, …]" (or "Type:[…]"), or returns null.
export function parseApexRecord(text: string): ApexRecord | null {
  const start = /^([A-Za-z_][\w.$]*)(:?)\[/.exec(text)
  if (!start) return null
  const open = start[0].length - 1
  let close = closingBracket(text, open)
  // Unbalanced brackets inside a value (an endpoint with "(" in it): the
  // last "]" closes the object.
  if (close < 0) close = text.lastIndexOf(']')
  if (close <= open) return null
  const inner = text.slice(open + 1, close)
  const fields: [string, string][] = []
  for (const part of inner ? splitTopLevel(inner) : []) {
    const field = fieldRegex.exec(part)
    if (field) fields.push([field[1], field[2]])
    else if (fields.length) {
      // A ", " inside a value: part of the field before.
      fields[fields.length - 1][1] += `, ${part}`
    } else return null
  }
  return {
    type: start[1],
    separator: start[2],
    fields,
    suffix: text.slice(close + 1)
  }
}

function looksLikeMarkup(text: string): boolean {
  return /^\s*</.test(text) && text.includes('>')
}

function isJsonContainer(text: string): boolean {
  return /^\s*[[{]/.test(text) && isJsonString(text)
}

// A field value worth pretty-printing on lines of its own.
function canBeautifyValue(value: string): boolean {
  return (
    isJsonContainer(value) ||
    looksLikeMarkup(value) ||
    Boolean(parseApexRecord(value.trim()))
  )
}

function beautifyValue(value: string, indent: string): string {
  let pretty = value
  const record = parseApexRecord(value.trim())
  if (record) pretty = formatRecord(record)
  else if (isJsonContainer(value))
    pretty = jsBeautify.js(value.trim(), { indent_size: 2 })
  else if (looksLikeMarkup(value))
    pretty = jsBeautify.html(value.trim(), { indent_size: 2 })
  return pretty.split('\n').join(`\n${indent}`)
}

// One field per line, indented; JSON, XML and nested objects in a value are
// pretty-printed and indented below their key. The commas stay, so the text
// reads as logged.
function formatRecord(record: ApexRecord): string {
  const indent = '  '
  const last = record.fields.length - 1
  const lines = record.fields.map(
    ([key, value], i) =>
      `${indent}${key}=${beautifyValue(value, indent)}${i < last ? ',' : ''}`
  )
  const open = `${record.type}${record.separator}[`
  if (!lines.length) return `${open}]${record.suffix}`
  return `${open}\n${lines.join('\n')}\n]${record.suffix}`
}

// Objects with fewer fields read fine on one line
// ("System.HttpResponse[Status=OK, StatusCode=200]").
export const MIN_FIELDS_TO_EXPAND = 3

// Whether expanding this value is worth a button: an object with at least
// MIN_FIELDS_TO_EXPAND fields or with a field worth pretty-printing (JSON,
// XML, a nested object), or a JSON, XML, HTML or Apex object value. Short
// requests and responses such as "System.HttpRequest[Endpoint=…, Method=GET]"
// get no button, so it marks the entries where expanding helps.
export function canBeautifyCallout(message: string): boolean {
  const record = parseApexRecord(message.trim())
  if (record) {
    return (
      record.fields.length >= MIN_FIELDS_TO_EXPAND ||
      record.fields.some(([, value]) => canBeautifyValue(value))
    )
  }
  return canBeautify(message)
}

// The callout value pretty-printed; anything else is returned unchanged.
export function beautifyCallout(message: string): string {
  const record = parseApexRecord(message.trim())
  if (record) return formatRecord(record)
  return beautifyUserDebug(message)
}

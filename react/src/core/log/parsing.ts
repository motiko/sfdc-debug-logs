// Parsing of Apex debug logs, shared by both log views: the app
// (pages/logs/components/parsed-log.js) and the classic log page
// (extension/debug-log-page.ts, via classic-blocks.ts). Splits a log into its
// header and entries, finds each entry's event type, splits out Salesforce
// ids for linking, and pretty-prints USER_DEBUG messages.
//
// Everything here returns plain text: the views turn it into DOM text nodes
// (or React text), never HTML, since logs carry data from untrusted users (for
// example System.debug of a public Site's input).
import jsBeautify from 'js-beautify'

export { eventCategory, logEventToType, LOG_CATEGORIES } from './categories'
export type { LogCategory } from './categories'

// "12:01:02.123 (1234567)|EVENT_TYPE"
const entryHeaderRegex = /^\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|([A-Z_]*)/

// A Salesforce record id (15 or 18 characters).
export const sfIdRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g

export interface SplitLog {
  // The lines before the first entry: API version and log levels, and the
  // "Execute Anonymous:" source lines.
  intro: string | null
  entries: string[]
}

export function splitLog(body: string): SplitLog {
  const intro = body.match(
    /^\d{1,2}\.\d\s[^]*?(?=\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\))/m
  )
  // Each entry runs until the next timestamp, or to the end of the log: the
  // last entry has no timestamp after it and used to be dropped.
  const entries =
    body.match(
      /^\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|[A-Z_]*[^]*?(?=\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)|(?![^]))/gm
    ) || []
  return { intro: intro ? intro[0] : null, entries }
}

// The entry's (or line's) event type ("USER_DEBUG", "SOQL_EXECUTE_BEGIN", …),
// or null if it doesn't start with a timestamp and event.
export function eventTypeOf(entry: string): string | null {
  const match = entryHeaderRegex.exec(entry)
  return match ? match[1] : null
}

// Keeps the entries whose event type is in visibleEvents; all entries if
// visibleEvents is empty.
export function filterEntries(
  entries: string[],
  visibleEvents: string[]
): string[] {
  if (visibleEvents.length == 0) return entries
  return entries.filter(entry => {
    const eventType = eventTypeOf(entry)
    if (eventType === null) {
      console.error(`Didn't find event type for ${entry} `)
      return false
    }
    return visibleEvents.indexOf(eventType) > -1
  })
}

export type TextOrId = string | { id: string }

// Splits text into plain strings and Salesforce ids ({ id }), keeping all
// text, including after the last id.
export function splitIds(text: string): TextOrId[] {
  const result: TextOrId[] = []
  let last = 0
  for (const match of text.matchAll(sfIdRegex)) {
    if (match.index > last) result.push(text.slice(last, match.index))
    result.push({ id: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) result.push(text.slice(last))
  return result
}

// Splits a USER_DEBUG entry or line into its header ("…|USER_DEBUG|[12]|
// DEBUG|", with or without the timestamp) and the logged message, or returns
// null if it isn't one.
export function splitUserDebug(
  entry: string
): { header: string; message: string } | null {
  const parsed = entry.match(
    /^((?:\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|)?USER_DEBUG\|\[\d+\]\|[A-Z_]+\|)([^]*)/
  )
  return parsed ? { header: parsed[1], message: parsed[2] } : null
}

// The entry with its USER_DEBUG message pretty-printed; other entries as is.
export function indentUserDebug(entry: string): string {
  const parsed = splitUserDebug(entry)
  return parsed ? `${parsed.header}${beautifyUserDebug(parsed.message)}` : entry
}

// Whether beautifyUserDebug changes the format of this message.
export function canBeautify(userDebug: string): boolean {
  return Boolean(
    looksLikeHtml(userDebug) ||
    isJsonString(userDebug) ||
    looksLikeSfdcObject(userDebug)
  )
}

// Pretty-prints HTML, JSON or an Apex object's toString()
// ("Account:{Id=001…, Name=Acme}"); anything else is returned unchanged.
// JSON is re-indented as text rather than parsed and printed again, so large
// numbers and duplicate keys stay exactly as logged.
export function beautifyUserDebug(userDebug: string): string {
  if (looksLikeHtml(userDebug)) {
    return jsBeautify.html(userDebug)
  }
  if (isJsonString(userDebug)) {
    return jsBeautify.js(userDebug.trim(), { indent_size: 2 })
  }
  if (looksLikeSfdcObject(userDebug)) {
    return jsBeautify.js(sfdcObjectBeautify(userDebug))
  }
  return userDebug
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
  } catch {
    return false
  }
  return true
}

// Turns an Apex object's toString() into a JS object literal:
// "Account:{Id=001…, Name=Acme}" -> "Account:{Id:'001…', Name:'Acme'}".
export function sfdcObjectBeautify(string: string): string {
  string = string.replace(/={/g, ':{')
  return string.replace(
    /([{| |[]\w+)=(.+?)(?=, |},|}\)|:{|])/g,
    function (match, p1, p2) {
      return p1 + ":'" + p2 + "'"
    }
  )
}

export function looksLikeSfdcObject(string: string): RegExpMatchArray | null {
  return string.match(/\w+:{\w+=.+,?\s*}/)
}

export function looksLikeHtml(source: string): boolean | '' {
  const trimmed = source.replace(/^[ \t\n\r]+/, '')
  return trimmed && trimmed.substring(0, 1) === '<'
}

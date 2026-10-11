// Pure helpers behind the log view (components/parsed-log.js): split an Apex
// debug log into its header and entries, find each entry's event type and
// color category, split out Salesforce ids for linking, and pretty-print
// USER_DEBUG messages.
import jsBeautify from 'js-beautify'
import { sfIdRegex, logEventToType } from './constants'

// "12:01:02.123 (1234567)|EVENT_TYPE"
const entryHeaderRegex = /^\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|([A-Z_]*)/

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

// The entry's event type ("USER_DEBUG", "SOQL_EXECUTE_BEGIN", …), or null if
// the entry doesn't start with a timestamp and event.
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

// The theme color category (debug, soql, method, …) for an event type.
export function eventCategory(eventType: string): string {
  const found = Object.entries(logEventToType).find(([prefix]) =>
    eventType.startsWith(prefix)
  )
  return found ? found[1] : 'rest'
}

// Splits text at Salesforce ids: ids are at the odd indexes, the text around
// them at the even ones, so all text is kept, including after the last id.
export function splitAtIds(text: string): string[] {
  return text.split(new RegExp(`(${sfIdRegex.source})`))
}

// Splits a USER_DEBUG entry into its header ("…|USER_DEBUG|[12]|DEBUG|") and
// the logged message, or returns null if it isn't one.
export function parseUserDebug(
  entry: string
): { header: string; message: string } | null {
  const parsed = entry.match(
    /^(\d\d:\d\d:\d\d\.\d{0,3}\s\(\d+\)\|USER_DEBUG\|\[\d+\]\|[A-Z_]+\|)([^]*)/m
  )
  if (parsed && parsed.length > 2) {
    return { header: parsed[1], message: parsed[2] }
  }
  return null
}

// The entry with its USER_DEBUG message pretty-printed; other entries as is.
export function indentUserDebug(entry: string): string {
  const parsed = parseUserDebug(entry)
  return parsed ? `${parsed.header}${beautifyUserDebug(parsed.message)}` : entry
}

// Pretty-prints HTML, JSON or an Apex object's toString()
// ("Account:{Id=001…, Name=Acme}"); anything else is returned unchanged.
export function beautifyUserDebug(userDebug: string): string {
  if (looksLikeHtml(userDebug)) {
    return jsBeautify.html(userDebug)
  }
  if (isJsonString(userDebug)) {
    return JSON.stringify(JSON.parse(userDebug), null, 2)
  }
  if (looksLikeSfdcObject(userDebug)) {
    return jsBeautify.js(sfdcObjectBeautify(userDebug))
  }
  return userDebug
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
  } catch (e) {
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

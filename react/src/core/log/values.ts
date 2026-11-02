// The entries whose value both log views can expand (pretty-print): USER_DEBUG
// messages (parsing.ts) and callout requests and responses (callouts.ts).
import { beautifyCallout, canBeautifyCallout, splitCallout } from './callouts'
import { beautifyUserDebug, canBeautify, splitUserDebug } from './parsing'

export type ValueKind = 'debug' | 'callout'

export interface EntryValue {
  kind: ValueKind
  // "…|USER_DEBUG|[12]|DEBUG|" or "…|CALLOUT_REQUEST|[12]|".
  header: string
  message: string
}

// The entry's (or line's) header and value, or null if its value can't be
// expanded.
export function splitValue(entry: string): EntryValue | null {
  const debug = splitUserDebug(entry)
  if (debug) return { kind: 'debug', ...debug }
  const callout = splitCallout(entry)
  if (callout) return { kind: 'callout', ...callout }
  return null
}

// Whether expanding changes how the value reads.
export function canExpandValue(kind: ValueKind, message: string): boolean {
  return kind === 'callout' ? canBeautifyCallout(message) : canBeautify(message)
}

// The value pretty-printed.
export function expandValue(kind: ValueKind, message: string): string {
  return kind === 'callout'
    ? beautifyCallout(message)
    : beautifyUserDebug(message)
}

// The entry with its value pretty-printed; other entries as is.
export function expandEntry(entry: string): string {
  const value = splitValue(entry)
  return value
    ? `${value.header}${expandValue(value.kind, value.message)}`
    : entry
}

// Whether the entry has a value that expanding changes.
export function isExpandable(entry: string): boolean {
  const value = splitValue(entry)
  return Boolean(value && canExpandValue(value.kind, value.message))
}

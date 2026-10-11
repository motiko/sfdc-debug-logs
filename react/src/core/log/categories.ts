// The color categories of log lines, and which event types belong to each.
// Themes (themes.ts) define a style per category; both log views color each
// line by the category of its event type.
//
// No imports: the e2e flow imports this file directly with Node.

export const LOG_CATEGORIES = [
  'debug',
  'soql',
  'callout',
  'system',
  'rest',
  'method',
  'error'
] as const

export type LogCategory = (typeof LOG_CATEGORIES)[number]

// Event type prefix -> category. Event types without a match are 'rest'.
export const logEventToType: Record<string, LogCategory> = {
  USER_DEBUG: 'debug',
  SYSTEM_: 'system',
  ENTERING_MANAGED_PKG: 'system',
  SOQL_EXECUTE_: 'soql',
  METHOD_: 'method',
  CONSTRUCTOR_: 'method',
  CODE_UNIT: 'method',
  EXCEPTION_: 'error',
  FATAL_ERROR: 'error',
  CALLOUT: 'callout',
  VALIDATION_: 'method',
  EXECUTION_: 'rest',
  DML_BEGIN: 'rest',
  DML_END: 'rest'
}

// The category (debug, soql, method, …) of an event type.
export function eventCategory(eventType: string): LogCategory {
  const found = Object.entries(logEventToType).find(([prefix]) =>
    eventType.startsWith(prefix)
  )
  return found ? found[1] : 'rest'
}

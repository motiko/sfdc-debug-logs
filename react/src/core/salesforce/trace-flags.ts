// What a trace flag can be set to, as data: the debug level categories and
// levels, the extension's presets, the durations offered, and how a flag's
// traced entity and remaining time are described. No imports, so the client
// (client.ts), the app and the tests share it.

// Salesforce allows trace flags of at most 24 hours.
export const MAX_TRACE_MS = 24 * 60 * 60 * 1000

export const LOG_LEVELS = [
  'NONE',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'FINE',
  'FINER',
  'FINEST'
] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

// The DebugLevel fields, one per log category.
export const DEBUG_LEVEL_CATEGORIES = [
  'ApexCode',
  'ApexProfiling',
  'Callout',
  'Database',
  'System',
  'Validation',
  'Visualforce',
  'Workflow',
  'Wave',
  'Nba'
] as const
export type DebugCategory = (typeof DEBUG_LEVEL_CATEGORIES)[number]
export type CategoryLevels = Record<DebugCategory, LogLevel>

export const CATEGORY_LABELS: Record<DebugCategory, string> = {
  ApexCode: 'Apex code',
  ApexProfiling: 'Apex profiling',
  Callout: 'Callout',
  Database: 'Database',
  System: 'System',
  Validation: 'Validation',
  Visualforce: 'Visualforce',
  Workflow: 'Workflow',
  Wave: 'CRM Analytics',
  Nba: 'Next best action'
}

const allAt = (level: LogLevel): CategoryLevels =>
  Object.fromEntries(
    DEBUG_LEVEL_CATEGORIES.map(category => [category, level])
  ) as CategoryLevels

// The preset that adds method calls to the logs (the call tree's "Log
// methods…").
export const METHODS_PRESET_ID = 'apex-finest'

// Starting points for "Custom levels".
export const LEVEL_PRESETS: {
  id: string
  label: string
  levels: CategoryLevels
}[] = [
  {
    id: 'default',
    label: 'Default',
    levels: allAt('DEBUG')
  },
  {
    // Everything Apex does, with the rest kept short.
    id: 'apex-finest',
    label: 'Apex FINEST',
    levels: {
      ...allAt('INFO'),
      ApexCode: 'FINEST',
      System: 'DEBUG'
    }
  },
  {
    // Only System.debug output and errors: small logs.
    id: 'quiet',
    label: 'Quiet',
    levels: { ...allAt('NONE'), ApexCode: 'DEBUG' }
  }
]

// Durations offered for a new trace flag.
export const TRACE_DURATIONS: { label: string; ms: number }[] = [
  { label: '30 minutes', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: '24 hours', ms: MAX_TRACE_MS }
]

// A duration Salesforce accepts: at least a minute, at most 24 hours.
export function traceDurationMs(ms: number): number {
  const value = Math.floor(Number(ms))
  if (!Number.isFinite(value) || value <= 0) return MAX_TRACE_MS
  return Math.min(MAX_TRACE_MS, Math.max(60 * 1000, value))
}

// Trace flags for users log what they do; class and trigger flags set the
// levels inside that code.
export type TraceLogType = 'USER_DEBUG' | 'CLASS_TRACING'

export type EntityKind = 'user' | 'class' | 'trigger' | 'other'

// What a traced entity is, by the key prefix of its id.
export function entityKind(id: string): EntityKind {
  const prefix = String(id || '').slice(0, 3)
  if (prefix === '005') return 'user'
  if (prefix === '01p') return 'class'
  if (prefix === '01q') return 'trigger'
  return 'other'
}

export function logTypeFor(kind: EntityKind): TraceLogType {
  return kind === 'class' || kind === 'trigger' ? 'CLASS_TRACING' : 'USER_DEBUG'
}

export const LOG_TYPE_LABELS: Record<string, string> = {
  USER_DEBUG: 'User',
  CLASS_TRACING: 'Class or trigger',
  DEVELOPER_LOG: 'Developer Console'
}

// "2 h 5 min left", "12 min left", "less than a minute left".
export function formatRemaining(
  iso: string | null | undefined,
  now = Date.now()
): string {
  const end = new Date(iso || '').getTime()
  if (isNaN(end)) return ''
  const minutes = Math.floor((end - now) / 60000)
  if (minutes < 1) return end > now ? 'less than a minute left' : 'ended'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${minutes} min left`
  return rest ? `${hours} h ${rest} min left` : `${hours} h left`
}

// "Apex code FINEST, System DEBUG, others INFO": a short summary of a debug
// level's categories, naming the most common level once.
export function describeLevels(levels: Partial<CategoryLevels>): string {
  const set = DEBUG_LEVEL_CATEGORIES.filter(c => levels[c])
  if (!set.length) return ''
  const counts = new Map<LogLevel, number>()
  for (const c of set) counts.set(levels[c], (counts.get(levels[c]) || 0) + 1)
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const different = set.filter(c => levels[c] !== common)
  if (!different.length) return `${common} for every category`
  return [
    ...different.map(c => `${CATEGORY_LABELS[c]} ${levels[c]}`),
    `others ${common}`
  ].join(', ')
}

// SOQL LIKE pattern for "contains term", with the wildcards in the term
// escaped.
export function soqlContains(term: string): string {
  const escaped = String(term)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `'%${escaped}%'`
}

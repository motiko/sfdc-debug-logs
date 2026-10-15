// The log levels a debug log was written with, from its first line:
// "62.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO;...". No imports.

export type LogLevels = Record<string, string>

// Levels at which Salesforce writes METHOD_ENTRY/METHOD_EXIT lines.
const METHOD_LEVELS = new Set(['FINE', 'FINER', 'FINEST'])

export function parseLogLevels(header: string | undefined | null): LogLevels {
  const levels: LogLevels = {}
  // The header line only: the intro may go on with the anonymous code.
  const text = (header || '').split('\n')[0].trim()
  const firstSpace = text.indexOf(' ')
  if (firstSpace < 0) return levels
  for (const part of text.slice(firstSpace + 1).split(';')) {
    const [category, level] = part.split(',')
    if (category && level && /^[A-Z_]+$/.test(category.trim()))
      levels[category.trim()] = level.trim()
  }
  return levels
}

export function apexCodeLevel(levels: LogLevels): string | undefined {
  return levels.APEX_CODE
}

// Whether a log at these levels lists method calls. Unknown (no header):
// assume it does, so no notice nags on a log whose header is missing.
export function methodsLogged(levels: LogLevels): boolean {
  const level = apexCodeLevel(levels)
  return level === undefined || METHOD_LEVELS.has(level)
}

import { describe, expect, it } from 'vitest'
import {
  DEBUG_LEVEL_CATEGORIES,
  describeLevels,
  entityKind,
  formatRemaining,
  LEVEL_PRESETS,
  LOG_LEVELS,
  logTypeFor,
  MAX_TRACE_MS,
  soqlContains,
  TRACE_DURATIONS,
  traceDurationMs
} from './trace-flags'

describe('presets and durations', () => {
  it('sets every category to a known level in every preset', () => {
    for (const preset of LEVEL_PRESETS) {
      for (const category of DEBUG_LEVEL_CATEGORIES) {
        expect(LOG_LEVELS).toContain(preset.levels[category])
      }
    }
  })

  it('offers durations up to Salesforce’s 24 hour maximum', () => {
    expect(Math.max(...TRACE_DURATIONS.map(d => d.ms))).toBe(MAX_TRACE_MS)
    for (const d of TRACE_DURATIONS) expect(traceDurationMs(d.ms)).toBe(d.ms)
  })

  it('clamps durations to a minute .. 24 hours', () => {
    expect(traceDurationMs(48 * 3600_000)).toBe(MAX_TRACE_MS)
    expect(traceDurationMs(1000)).toBe(60_000)
    expect(traceDurationMs(NaN)).toBe(MAX_TRACE_MS)
    expect(traceDurationMs(-5)).toBe(MAX_TRACE_MS)
  })
})

describe('traced entities', () => {
  it('tells users, classes and triggers apart by key prefix', () => {
    expect(entityKind('005000000000001AAA')).toBe('user')
    expect(entityKind('01p000000000001AAA')).toBe('class')
    expect(entityKind('01q000000000001AAA')).toBe('trigger')
    expect(entityKind('0Lk000000000001AAA')).toBe('other')
  })

  it('traces code with CLASS_TRACING and users with USER_DEBUG', () => {
    expect(logTypeFor('class')).toBe('CLASS_TRACING')
    expect(logTypeFor('trigger')).toBe('CLASS_TRACING')
    expect(logTypeFor('user')).toBe('USER_DEBUG')
  })
})

describe('formatRemaining', () => {
  const now = Date.parse('2026-01-02T03:00:00Z')
  it('says how long a flag still runs', () => {
    expect(formatRemaining('2026-01-02T05:05:30Z', now)).toBe('2 h 5 min left')
    expect(formatRemaining('2026-01-02T04:00:00Z', now)).toBe('1 h left')
    expect(formatRemaining('2026-01-02T03:12:00Z', now)).toBe('12 min left')
    expect(formatRemaining('2026-01-02T03:00:30Z', now)).toBe(
      'less than a minute left'
    )
    expect(formatRemaining('2026-01-02T02:00:00Z', now)).toBe('ended')
    expect(formatRemaining(null, now)).toBe('')
  })
})

describe('describeLevels', () => {
  it('names the common level once and the categories that differ', () => {
    expect(describeLevels(LEVEL_PRESETS[0].levels)).toBe(
      'DEBUG for every category'
    )
    expect(
      describeLevels(LEVEL_PRESETS.find(p => p.id === 'apex-finest').levels)
    ).toBe('Apex code FINEST, System DEBUG, others INFO')
    expect(describeLevels({})).toBe('')
  })
})

describe('soqlContains', () => {
  it('escapes quotes, backslashes and LIKE wildcards', () => {
    expect(soqlContains('Ada')).toBe("'%Ada%'")
    expect(soqlContains("O'Brien_50%\\")).toBe("'%O\\'Brien\\_50\\%\\\\%'")
  })
})

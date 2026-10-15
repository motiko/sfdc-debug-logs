import { describe, expect, it } from 'vitest'
import { apexCodeLevel, methodsLogged, parseLogLevels } from './log-levels'

const HEADER =
  '62.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO;CALLOUT,INFO;DB,INFO;NBA,INFO;SYSTEM,DEBUG;VALIDATION,INFO;VISUALFORCE,INFO;WAVE,INFO;WORKFLOW,INFO'

describe('parseLogLevels', () => {
  it('reads the level of every category from the first line', () => {
    const levels = parseLogLevels(HEADER)
    expect(levels.APEX_CODE).toBe('DEBUG')
    expect(levels.SYSTEM).toBe('DEBUG')
    expect(levels.WORKFLOW).toBe('INFO')
    expect(Object.keys(levels)).toHaveLength(10)
  })

  it('gives nothing for a missing or odd first line', () => {
    expect(parseLogLevels(undefined)).toEqual({})
    expect(parseLogLevels('')).toEqual({})
    expect(parseLogLevels('EXECUTION_STARTED')).toEqual({})
    expect(parseLogLevels('62.0')).toEqual({})
  })

  it('reads only the first line of a header that goes on with the code', () => {
    const levels = parseLogLevels(
      `${HEADER}\nExecute Anonymous: Integer x = 1;\nExecute Anonymous: System.debug(x);`
    )
    expect(levels.WORKFLOW).toBe('INFO')
    expect(Object.keys(levels)).toHaveLength(10)
  })

  it('ignores a trailing newline and whitespace', () => {
    expect(apexCodeLevel(parseLogLevels(' 62.0 APEX_CODE,FINE \n'))).toBe(
      'FINE'
    )
  })
})

describe('methodsLogged', () => {
  it('is true from FINE up', () => {
    for (const level of ['FINE', 'FINER', 'FINEST'])
      expect(methodsLogged({ APEX_CODE: level })).toBe(true)
  })

  it('is false below FINE', () => {
    for (const level of ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG'])
      expect(methodsLogged({ APEX_CODE: level })).toBe(false)
  })

  it('assumes yes without a header', () => {
    expect(methodsLogged({})).toBe(true)
  })
})

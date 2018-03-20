export const maxLogSizeToParse = 1000000,
  maxLogSize = 2 * Math.pow(10, 6)

export const defaultLogThemes = {
  dark: {
    themeName: 'dark',
    debug: '#a6e22e',
    soql: '#66d9ef',
    callout: '#ae81ff',
    system: '#75715e',
    rest: '#f8f8f2',
    method: '#e6db74',
    error: '#f92672',
    background: '#292724'
  },
  light: {
    themeName: 'light',
    debug: '#0000FF',
    soql: '#AA22FF',
    callout: '#A0A000',
    system: '#008800',
    rest: '#880000',
    method: '#BB4444',
    error: '#f92672',
    background: '#ffffcc'
  },
  bw: {
    themeName: 'bw',
    debug: '#000',
    soql: '#000',
    callout: '#000',
    system: '#000',
    rest: '#000',
    method: '#000',
    error: '#000',
    background: '#fff'
  }
}

export const sfIdRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g
export const logEventToType = {
  USER_DEBUG: 'debug',
  SYSTEM_: 'system',
  ENTERING_MANAGED_PKG: 'system',
  SOQL_EXECUTE_: 'soql',
  METHOD_: 'method',
  CONSTRUCTOR_: 'method',
  CODE_UNIT: 'method',
  EXCEPTION_: 'err',
  FATAL_ERROR: 'err',
  CALLOUT: 'callout',
  VALIDATION_: 'method',
  EXECUTION_: 'rest',
  DML_BEGIN: 'rest',
  DML_END: 'rest'
}

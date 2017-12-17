// Prism.plugins.customClass.prefix('pr-')
import globalSf from './global-sf'

Prism.languages.apexlog = {
  'apex-id': /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/,
  'execute-anonymous': {
    pattern: /Execute Anonymous:[^\n]+/,
    alias: 'comment'
  },
  'cpu-time': {
    pattern: /\(\d+\)(?=\|)/,
    alias: 'comment'
  },
  'timestamp': {
    pattern: /^\d\d:\d\d:\d\d\.\d/m,
    alias: 'comment'
  },
  'user-debug': {
    pattern: /(\|USER_DEBUG\|\[\d+\]\|\w+\|)[^\u0011-\u0014]+[\u0011-\u0014]/,
    lookbehind: true,
    inside: {
      'json': {
        pattern: /[\s\S]+[\u0011-\u0012]/,
        inside: Prism.languages.json
      },
      'xml': {
        pattern: /[\s\S]+[\u0013-\u0014]/,
        inside: Prism.languages.markup
      }
    }
  },
  'soql': {
    pattern: /(\|SOQL_EXECUTE_BEGIN\|\[\d+]\|Aggregations:\d+\|)[^\n]+/,
    lookbehind: true,
    inside: Prism.languages.sql
  }
}

Prism.hooks.add('wrap', (env) => {
  if (/^apex-id$/.test(env.type)) {
    env.tag = 'a'
    var id = env.content
    env.attributes.href = `https://${globalSf.hostname}/${id}`
  }
})

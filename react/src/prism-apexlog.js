// window.Prism.plugins.customClass.prefix('pr-')
import globalSf from './global-sf'

window.Prism.languages.apexlog = {
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
        inside: window.Prism.languages.json
      },
      'xml': {
        pattern: /[\s\S]+[\u0013-\u0014]/,
        inside: window.Prism.languages.markup
      }
    }
  },
  'soql': {
    pattern: /(\|SOQL_EXECUTE_BEGIN\|\[\d+]\|Aggregations:\d+\|)[^\n]+/,
    lookbehind: true,
    inside: window.Prism.languages.soql
  }
}

window.Prism.languages.soql = {
  'string': {
    pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\])*\2/,
    greedy: true,
    lookbehind: true
  },
  'function': /\b(?:COUNT|SUM|AVG|MIN|MAX|FIRST|LAST|UCASE|LCASE|MID|LEN|ROUND|NOW|FORMAT)(?=\s*\()/i, // Should we highlight user defined functions too?
  'keyword': /\b(?:SELECT|TYPEOF|END|FROM|USING|SCOPE|WHERE|WITH|DATA|CATEGORY|GROUP|BY|ROLLUP|CUBE|HAVING|ORDER|BY|ASC|DESC|NULLS|FIRST|LAST|LIMIT|OFFSET|FOR|VIEW|REFERENCE|UPDATE|TRACKING|VIEWSTAT)\b/i,
  'boolean': /\b(?:TRUE|FALSE|NULL)\b/i,
  'number': /\b-?(?:0x)?\d*\.?[\da-f]+\b/,
  'operator': /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|IN|LIKE|NOT|OR|IS|DIV|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  'punctuation': /[;[\]()`,.]/
}

window.Prism.hooks.add('wrap', (env) => {
  if (/^apex-id$/.test(env.type)) {
    env.tag = 'a'
    var id = env.content
    env.attributes.href = `https://${globalSf.hostname}/${id}`
  }
})

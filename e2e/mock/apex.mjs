// A tiny anonymous-Apex runner for the mock org (mock/org.mjs): enough of the
// language to run the snippets the e2e flow and the UX audit execute
// (variables, string concatenation, System.debug with a logging level,
// JSON.serialize of map literals, SOQL on a few objects, for loops, try/catch,
// division by zero, Limits, HTTP callouts with HttpRequest and Http.send)
// and to write the debug log Salesforce would:
// header, the echoed source, USER_DEBUG, SOQL, method, system and exception
// entries, callouts (with Named Credential entries for "callout:" endpoints),
// limit usage. Anything it doesn't understand is debugged as its
// source text, so a new snippet still produces a log.

class ApexException extends Error {
  constructor(type, message) {
    super(message)
    this.type = type
  }
}

// Splits `src` at top-level occurrences of `sep` (outside quotes, (), {}, []).
function splitTop(src, sep) {
  const parts = []
  let depth = 0
  let quote = false
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === "'") quote = false
      continue
    }
    if (c === "'") quote = true
    else if ('({['.includes(c)) depth++
    else if (')}]'.includes(c)) depth--
    else if (depth === 0 && src.startsWith(sep, i)) {
      parts.push(src.slice(start, i))
      start = i + sep.length
      i += sep.length - 1
    }
  }
  parts.push(src.slice(start))
  return parts
}

// The index just after the bracket that closes the one at `open`.
function matching(src, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' }
  let depth = 0
  let quote = false
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === "'") quote = false
      continue
    }
    if (c === "'") quote = true
    else if (c in pairs) depth++
    else if (Object.values(pairs).includes(c)) {
      depth--
      if (depth === 0) return i + 1
    }
  }
  throw new Error(`unbalanced brackets in: ${src.slice(open, open + 40)}`)
}

// Statements of a block: simple ones (up to ";"), for loops and try/catch.
function parseBlock(src, baseLine = 1) {
  const statements = []
  let i = 0
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++
    if (i >= src.length) break
    const rest = src.slice(i)
    const line = baseLine + src.slice(0, i).split('\n').length - 1
    const lineAt = index => baseLine + src.slice(0, index).split('\n').length - 1
    if (/^for\s*\(/.test(rest)) {
      const open = i + rest.indexOf('(')
      const close = matching(src, open)
      const bodyOpen = src.indexOf('{', close)
      const bodyClose = matching(src, bodyOpen)
      const [init, cond] = src.slice(open + 1, close - 1).split(';')
      statements.push({
        type: 'for',
        line,
        init,
        cond,
        body: parseBlock(src.slice(bodyOpen + 1, bodyClose - 1), lineAt(bodyOpen + 1))
      })
      i = bodyClose
    } else if (/^try\s*\{/.test(rest)) {
      const open = i + rest.indexOf('{')
      const close = matching(src, open)
      const catchMatch = /^\s*catch\s*\(\s*([\w.]+)\s+(\w+)\s*\)\s*/.exec(src.slice(close))
      const catchOpen = close + catchMatch[0].length
      const catchClose = matching(src, catchOpen)
      statements.push({
        type: 'try',
        line,
        body: parseBlock(src.slice(open + 1, close - 1), lineAt(open + 1)),
        catchType: catchMatch[1],
        catchVar: catchMatch[2],
        handler: parseBlock(src.slice(catchOpen + 1, catchClose - 1), lineAt(catchOpen + 1))
      })
      i = catchClose
    } else {
      const [statement] = splitTop(rest, ';')
      const leading = statement.length - statement.trimStart().length
      statements.push({ type: 'simple', line: lineAt(i + leading), code: statement.trim() })
      i += statement.length + 1
    }
  }
  return statements
}

// HttpRequest and HttpResponse, logged the way Salesforce prints them.
class HttpRequest {
  endpoint = null
  method = null
  body = null
  toString() {
    return `System.HttpRequest[Endpoint=${this.endpoint}, Method=${this.method}]`
  }
}

class HttpResponse {
  constructor(statusCode, body) {
    this.statusCode = statusCode
    this.body = body
  }
  toString() {
    return `System.HttpResponse[Status=${this.statusCode === 200 ? 'OK' : 'Error'}, StatusCode=${this.statusCode}]`
  }
}

const toApexString = value => {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `(${value.map(toApexString).join(', ')})`
  if (value && value.sobject) {
    const fields = Object.entries(value.fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    return `${value.sobject}:{${fields}}`
  }
  if (value instanceof Map) return JSON.stringify(Object.fromEntries(value))
  return String(value)
}

const toJson = value => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, toJson(v)]))
  if (Array.isArray(value)) return value.map(toJson)
  if (value && value.sobject) return { attributes: { type: value.sobject }, ...value.fields }
  return value
}

// Runs `apex` as `user` against `data` ({ User: [...], Account: [...] }) and
// returns { log, success, exceptionMessage, line }.
export function runAnonymousApex(apex, { user, data, start = new Date() }) {
  const lines = []
  let nanos = 1_000_000
  let ms = start.getTime()
  let queries = 0
  const time = () => {
    nanos += 1_234_567
    ms += 1
    const d = new Date(ms)
    const pad = (n, w = 2) => String(n).padStart(w, '0')
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)} (${nanos})`
  }
  const entry = (...parts) => lines.push([time(), ...parts].join('|'))
  const vars = new Map()

  function query(soql, line) {
    queries++
    const object = /\bFROM\s+(\w+)/i.exec(soql)[1]
    const fields = /^SELECT\s+([\s\S]+?)\s+FROM/i
      .exec(soql)[1]
      .split(',')
      .map(f => f.trim())
    const limit = Number((/\bLIMIT\s+(\d+)/i.exec(soql) || [])[1] || 50000)
    const nameMatch = /Name\s*=\s*'([^']*)'/i.exec(soql)
    let rows = data[object] || []
    if (nameMatch) rows = rows.filter(r => r.Name === nameMatch[1])
    rows = rows.slice(0, limit)
    entry('SOQL_EXECUTE_BEGIN', `[${line}]`, 'Aggregations:0', soql)
    entry('SOQL_EXECUTE_END', `[${line}]`, `Rows:${rows.length}`)
    return rows.map(r => ({
      sobject: object,
      fields: Object.fromEntries(fields.filter(f => f in r).map(f => [f, r[f]]))
    }))
  }

  function evaluate(expr, line) {
    expr = expr.trim()
    const terms = splitTop(expr, '+')
    if (terms.length > 1) {
      const values = terms.map(t => evaluate(t, line))
      if (values.every(v => typeof v === 'number')) return values.reduce((a, b) => a + b, 0)
      return values.map(toApexString).join('')
    }
    const division = splitTop(expr, '/')
    if (division.length === 2 && !expr.startsWith("'")) {
      const [a, b] = division.map(t => evaluate(t, line))
      if (Number(b) === 0) throw new ApexException('System.MathException', 'Divide by 0')
      return Math.trunc(Number(a) / Number(b))
    }
    if (/^'([^'\\]|\\.)*'$/.test(expr)) return expr.slice(1, -1).replace(/\\(.)/g, '$1')
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr)
    if (expr === 'true' || expr === 'false') return expr === 'true'
    if (expr.startsWith('(') && matching(expr, 0) === expr.length) return evaluate(expr.slice(1, -1), line)
    const repeat = /^([\s\S]+)\.repeat\((\d+)\)$/.exec(expr)
    if (repeat) return String(evaluate(repeat[1], line)).repeat(Number(repeat[2]))
    if (expr.startsWith('[') && expr.endsWith(']')) return query(expr.slice(1, -1).trim(), line)
    if (/^UserInfo\.getUserId\(\)$/.test(expr)) return user.Id
    if (/^UserInfo\.getName\(\)$/.test(expr)) return user.Name
    const json = /^JSON\.serialize(?:Pretty)?\(([\s\S]+)\)$/.exec(expr)
    if (json) return JSON.stringify(toJson(evaluate(json[1], line)))
    const map = /^new\s+Map\s*\{([\s\S]*)\}$/.exec(expr)
    if (map) {
      const result = new Map()
      for (const pair of splitTop(map[1], ',')) {
        if (!pair.trim()) continue
        const [k, v] = splitTop(pair, '=>')
        result.set(evaluate(k, line), evaluate(v, line))
      }
      return result
    }
    const list = /^new\s+(?:List|Set)\s*\{([\s\S]*)\}$/.exec(expr)
    if (list)
      return splitTop(list[1], ',')
        .filter(s => s.trim())
        .map(s => evaluate(s, line))
    const limits = /^Limits\.get(Limit)?(\w+)\(\)$/.exec(expr)
    if (limits) {
      const max = { Queries: 100, CpuTime: 10000, HeapSize: 6000000, DmlStatements: 150 }
      if (limits[1]) return max[limits[2]] ?? 0
      return { Queries: queries, CpuTime: 12, HeapSize: 2048, DmlStatements: 0 }[limits[2]] ?? 0
    }
    const exceptionCall = /^(\w+)\.(getMessage|getTypeName|getStackTraceString)\(\)$/.exec(expr)
    if (exceptionCall && vars.get(exceptionCall[1]) instanceof ApexException) {
      const e = vars.get(exceptionCall[1])
      return {
        getMessage: e.message,
        getTypeName: e.type,
        getStackTraceString: `AnonymousBlock: line ${line}, column 1`
      }[exceptionCall[2]]
    }
    if (/^new\s+HttpRequest\(\)$/.test(expr)) return new HttpRequest()
    const send = /^new\s+Http\(\)\.send\((\w+)\)$/.exec(expr)
    if (send) return callout(vars.get(send[1]), line)
    const response = /^(\w+)\.(getBody|getStatusCode)\(\)$/.exec(expr)
    if (response && vars.get(response[1]) instanceof HttpResponse) {
      const res = vars.get(response[1])
      return response[2] === 'getBody' ? res.body : res.statusCode
    }
    if (/^\w+$/.test(expr) && vars.has(expr)) return vars.get(expr)
    return expr
  }

  // An HTTP callout: every request gets a 200 with a small JSON body.
  function callout(request, line) {
    const named = /^callout:(\w+)/.exec(request.endpoint || '')
    const credential = named && `Named Credential Id=0XAMK0000000001, Named Credential Name=${named[1]}`
    const size = (request.body || '').length
    const body = JSON.stringify({ ok: true, method: request.method, received: size })
    if (named) {
      entry(
        'NAMED_CREDENTIAL_REQUEST',
        `NamedCallout[${credential}, Endpoint=${request.endpoint}, Method=${request.method}, ` +
          `External Credential Type=EXTERNAL, Content-Type=application/json, ` +
          `Request Size bytes=${size}, Retry on 401=True]`
      )
    }
    entry('CALLOUT_REQUEST', `[${line}]`, String(request))
    const res = new HttpResponse(200, body)
    if (named) {
      entry(
        'NAMED_CREDENTIAL_RESPONSE',
        `NamedCallout[${credential}, Status Code=200, Content-Type=application/json, ` +
          `Response Size bytes=${body.length}, Overall Callout Time ms=42, Connect Time ms=7]`
      )
    }
    entry('CALLOUT_RESPONSE', `[${line}]`, String(res))
    return res
  }

  function runSimple({ code, line }) {
    const setter = /^(\w+)\.(setEndpoint|setMethod|setBody)\(([\s\S]*)\)$/.exec(code)
    if (setter && vars.get(setter[1]) instanceof HttpRequest) {
      const field = { setEndpoint: 'endpoint', setMethod: 'method', setBody: 'body' }[setter[2]]
      vars.get(setter[1])[field] = evaluate(setter[3], line)
      return
    }
    const debug = /^System\.debug\(([\s\S]*)\)$/.exec(code)
    if (debug) {
      const args = splitTop(debug[1], ',')
      let level = 'DEBUG'
      if (args.length > 1 && /^\s*LoggingLevel\.\w+\s*$/.test(args[0])) level = args.shift().trim().split('.')[1]
      const value = toApexString(evaluate(args.join(','), line))
      entry('USER_DEBUG', `[${line}]`, level, value)
      return
    }
    const declaration = /^([A-Za-z_][\w.]*(?:<[^=]*>)?)\s+(\w+)\s*=\s*([\s\S]+)$/.exec(code)
    if (declaration) {
      let value = evaluate(declaration[3], line)
      const type = declaration[1]
      if (Array.isArray(value) && /^[A-Z]\w*$/.test(type) && !/^(String|Integer|Object|Map|List|Set)$/.test(type)) {
        // A single SObject from a query.
        if (value.length !== 1) {
          throw new ApexException('System.QueryException', 'List has no rows for assignment to SObject')
        }
        value = value[0]
      }
      vars.set(declaration[2], value)
      entry('VARIABLE_ASSIGNMENT', `[${line}]`, declaration[2], toApexString(value).slice(0, 80))
      return
    }
    const assignment = /^(\w+)\s*(\+?=)\s*([\s\S]+)$/.exec(code)
    if (assignment) {
      const value = evaluate(assignment[3], line)
      vars.set(assignment[1], assignment[2] === '+=' ? (vars.get(assignment[1]) || 0) + value : value)
      return
    }
    evaluate(code, line)
  }

  function runBlock(statements) {
    for (const statement of statements) {
      if (statement.type === 'simple') {
        try {
          runSimple(statement)
        } catch (e) {
          if (e instanceof ApexException && !e.logged) {
            entry('EXCEPTION_THROWN', `[${statement.line}]`, `${e.type}: ${e.message}`)
            e.logged = true
            e.line = statement.line
          }
          throw e
        }
      } else if (statement.type === 'for') {
        const init = /(\w+)\s*=\s*(-?\d+)/.exec(statement.init)
        const cond = /(\w+)\s*<\s*(\w+)/.exec(statement.cond)
        const end = Number(evaluate(cond[2], statement.line))
        for (let i = Number(init[2]); i < end; i++) {
          vars.set(init[1], i)
          runBlock(statement.body)
        }
      } else if (statement.type === 'try') {
        try {
          runBlock(statement.body)
        } catch (e) {
          if (!(e instanceof ApexException)) throw e
          vars.set(statement.catchVar, e)
          runBlock(statement.handler)
        }
      }
    }
  }

  const source = apex.trim()
  const header =
    '62.0 APEX_CODE,DEBUG;APEX_PROFILING,DEBUG;CALLOUT,DEBUG;DB,DEBUG;NBA,DEBUG;SYSTEM,DEBUG;VALIDATION,DEBUG;VISUALFORCE,DEBUG;WAVE,DEBUG;WORKFLOW,DEBUG'
  const echo = source.split('\n').map(l => `Execute Anonymous: ${l}`)
  entry('USER_INFO', '[EXTERNAL]', user.Id, user.Username, '(GMT+00:00) Greenwich Mean Time (GMT)', 'GMT+00:00')
  entry('EXECUTION_STARTED')
  entry('CODE_UNIT_STARTED', '[EXTERNAL]', 'execute_anonymous_apex')
  entry('METHOD_ENTRY', '[1]', '01pMK0000000009AAA', 'MockSetup.run()')
  entry('SYSTEM_METHOD_ENTRY', '[1]', 'System.now()')
  entry('SYSTEM_METHOD_EXIT', '[1]', 'System.now()')
  entry('METHOD_EXIT', '[1]', '01pMK0000000009AAA', 'MockSetup.run()')
  let failure = null
  try {
    // Collection literals without their type arguments (new Map{…}), so
    // commas in "<String, Object>" don't split anything.
    runBlock(parseBlock(source.replace(/new\s+(Map|List|Set)\s*<[^{}()]*?>\s*\{/g, 'new $1{')))
  } catch (e) {
    if (!(e instanceof ApexException)) throw e
    failure = e
    entry('FATAL_ERROR', `${e.type}: ${e.message}`)
  }
  entry('CUMULATIVE_LIMIT_USAGE')
  entry('LIMIT_USAGE_FOR_NS', '(default)', '')
  lines.push(`  Number of SOQL queries: ${queries} out of 100`, '  Maximum CPU time: 12 out of 10000', '')
  entry('CUMULATIVE_LIMIT_USAGE_END')
  lines.push('')
  entry('CODE_UNIT_FINISHED', 'execute_anonymous_apex')
  entry('EXECUTION_FINISHED')
  return {
    log: [header, ...echo, ...lines].join('\n') + '\n',
    success: !failure,
    exceptionMessage: failure ? `${failure.type}: ${failure.message}` : null,
    line: failure ? failure.line : -1,
    durationMs: ms - start.getTime()
  }
}

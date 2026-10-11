// Pure helpers behind the classic log page (debug-log-page.ts): group a raw
// Apex debug log into styled blocks, and split text around Salesforce ids.
// Everything stays plain text; the page turns it into DOM nodes with
// textContent, never HTML, since logs carry data from untrusted users (for
// example System.debug of a public Site's input).

// A block of the log: a <div> with these classes, or bare text when
// className is null. parts are text, or a nested block (the first line).
export interface LogBlock {
  className: string | null
  parts: (string | LogBlock)[]
}

const idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g

// Line markers and the classes of their <div> (themes in css/debug.css).
const logEntryToDivClass = [
  { logEntry: '|USER_DEBUG', divClass: 'debug' },
  { logEntry: '|SYSTEM_', divClass: 'system systemMethodLog searchable' },
  { logEntry: '|SOQL_EXECUTE_', divClass: 'soql searchable wrap' },
  { logEntry: '|SOQL_EXECUTE_END', divClass: 'soql searchable wrap' },
  { logEntry: '|METHOD_', divClass: 'method methodLog searchable' },
  { logEntry: '|CONSTRUCTOR_', divClass: 'method methodLog searchable' },
  { logEntry: '|EXCEPTION_', divClass: 'err searchable' },
  { logEntry: '|FATAL_ERROR', divClass: 'err searchable' },
  { logEntry: '|CODE_UNIT', divClass: 'method searchable' },
  { logEntry: '|CALLOUT', divClass: 'callout searchable' },
  { logEntry: '|VALIDATION_', divClass: 'method searchable' },
  { logEntry: '|EXECUTION_', divClass: 'rest searchable' },
  { logEntry: '|DML_BEGIN', divClass: 'rest searchable' },
  { logEntry: '|DML_END', divClass: 'rest searchable' },
  {
    logEntry: '|ENTERING_MANAGED_PKG',
    divClass: 'system systemMethodLog searchable'
  }
]

// One line of the log as a block. className null: a continuation line (for
// example of a multi-line USER_DEBUG or LIMIT_USAGE_FOR_NS).
export function classifyLine(line: string, showTimestamps: boolean): LogBlock {
  if (line.indexOf('Execute Anonymous:') === 0) {
    return { className: 'system searchable', parts: [line] }
  }
  const entry = logEntryToDivClass.find(e => line.indexOf(e.logEntry) > -1)
  if (entry) {
    const text = showTimestamps ? line : line.substr(line.indexOf('|') + 1)
    return { className: entry.divClass, parts: [text] }
  }
  if (line.split('|').length <= 2) {
    return { className: null, parts: [line] }
  }
  return { className: 'rest searchable', parts: [line] }
}

// The whole log as blocks: the first line (the header) inside a "rest" div,
// then one block per entry, with continuation lines appended to the entry
// before them.
export function logToBlocks(log: string, showTimestamps: boolean): LogBlock[] {
  const lines = log.split('\n').map(l => classifyLine(l, showTimestamps))
  const first = lines[0]
  if (lines.length === 1) return [first]
  const blocks: LogBlock[] = [
    {
      className: 'rest',
      parts: first.className ? [first] : first.parts.slice()
    }
  ]
  lines.slice(1).forEach((line, i) => {
    if (line.className || i === 0) {
      blocks.push(line)
    } else {
      blocks[blocks.length - 1].parts.push('\n', ...line.parts)
    }
  })
  return blocks
}

// Splits text into plain strings and Salesforce ids ({ id }).
export function splitIds(text: string): (string | { id: string })[] {
  const result: (string | { id: string })[] = []
  let last = 0
  for (const match of text.matchAll(idRegex)) {
    if (match.index > last) result.push(text.slice(last, match.index))
    result.push({ id: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) result.push(text.slice(last))
  return result
}

// "…|USER_DEBUG|[12]|DEBUG|message": the part up to and including the level,
// and the message. null if the line has no level.
export function splitUserDebug(
  text: string
): { header: string; message: string } | null {
  const level = text.match(/\[\d+\](\|[A-Z]+\|)/)
  if (!level) return null
  const end = text.indexOf(level[1]) + level[1].length
  return { header: text.slice(0, end), message: text.slice(end) }
}

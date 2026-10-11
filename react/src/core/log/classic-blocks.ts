// The classic log page's view of a log (extension/debug-log-page.ts): the
// raw log grouped into blocks, one per entry, each with the CSS classes the
// page styles and toggles. Lines are categorized like in the app (parsing.ts,
// categories.ts); the classes are the category's (CLASSIC_CATEGORY_CLASS,
// colored by the theme) plus the page's own markers.
import { eventCategory, eventTypeOf } from './parsing'
import { CLASSIC_CATEGORY_CLASS } from './themes'

// A block of the log: a <div> with these classes, or bare text when
// className is null. parts are text, or a nested block (the first line).
export interface LogBlock {
  className: string | null
  parts: (string | LogBlock)[]
}

// The classes of an entry's <div>: its category's class, plus
//   searchable     lines the browser's find should land on (USER_DEBUG
//                  marks its header and message spans instead);
//   systemMethodLog / methodLog   hidden by "Show System / User Methods";
//   wrap           long SOQL lines wrap.
function entryClasses(eventType: string): string {
  const category = eventCategory(eventType)
  const classes = [CLASSIC_CATEGORY_CLASS[category]]
  if (category === 'debug') return classes[0]
  if (/^(SYSTEM_|ENTERING_MANAGED_PKG)/.test(eventType)) {
    classes.push('systemMethodLog')
  }
  if (/^(METHOD_|CONSTRUCTOR_)/.test(eventType)) classes.push('methodLog')
  classes.push('searchable')
  if (category === 'soql') classes.push('wrap')
  return classes.join(' ')
}

// One line of the log as a block. className null: a continuation line (for
// example of a multi-line USER_DEBUG or LIMIT_USAGE_FOR_NS).
export function classifyLine(line: string, showTimestamps: boolean): LogBlock {
  if (line.indexOf('Execute Anonymous:') === 0) {
    return { className: 'system searchable', parts: [line] }
  }
  const eventType = eventTypeOf(line)
  if (eventType) {
    const text = showTimestamps ? line : line.substr(line.indexOf('|') + 1)
    return { className: entryClasses(eventType), parts: [text] }
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

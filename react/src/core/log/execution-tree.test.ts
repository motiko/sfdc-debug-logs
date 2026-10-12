import { describe, expect, it } from 'vitest'
import log from './__fixtures__/anonymous-apex.log?raw'
import { buildLines } from './log-lines'
import {
  allExpandable,
  buildExecutionTree,
  type ExecNode,
  expandedToDepth,
  formatNanos,
  rowForLine,
  timelineBars,
  unitName,
  visibleNodes
} from './execution-tree'

// A log from entries "nanos|EVENT|rest".
const logOf = (...entries: string[]) =>
  '62.0 APEX_CODE,FINE\n' +
  entries
    .map(e => {
      const [nanos, ...rest] = e.split('|')
      return `12:00:00.000 (${nanos})|${rest.join('|')}`
    })
    .join('\n') +
  '\n'
const treeOf = (...entries: string[]) =>
  buildExecutionTree(buildLines(logOf(...entries)))
const shape = (node: ExecNode): unknown =>
  node.children.length ? { [node.name]: node.children.map(shape) } : node.name

describe('buildExecutionTree', () => {
  const tree = buildExecutionTree(buildLines(log))

  it('nests the units of an anonymous Apex log', () => {
    expect(tree.roots.map(shape)).toEqual([
      {
        Execution: [
          {
            execute_anonymous_apex: [
              'SELECT Id, Name FROM Account LIMIT 2',
              'System.debug(ANY)'
            ]
          }
        ]
      }
    ])
    const [execution] = tree.roots
    const unit = execution.children[0]
    expect(unit).toMatchObject({
      kind: 'codeUnit',
      event: 'CODE_UNIT_STARTED',
      line: 3,
      depth: 1,
      start: 1256789,
      end: 17000000,
      total: 17000000 - 1256789,
      soql: 1,
      dml: 0,
      unclosed: false
    })
    const query = unit.children[0]
    expect(query).toMatchObject({ kind: 'soql', rows: 2, total: 6000000 })
    expect(query.endLine).toBe(query.line + 1)
    expect(tree.start).toBe(1234567)
    expect(tree.end).toBe(18000000)
    expect(tree.maxDepth).toBe(2)
    expect(tree.nodes.map(n => n.id)).toEqual([0, 1, 2, 3])
  })

  it('splits total time into self time and child time', () => {
    for (const node of tree.nodes) {
      const childTotal = node.children.reduce((sum, c) => sum + c.total, 0)
      expect(node.self + childTotal).toBe(node.total)
    }
  })

  it('counts SOQL and DML of a unit and everything it called', () => {
    const t = treeOf(
      '1|CODE_UNIT_STARTED|[EXTERNAL]|01q000000000001|AccTrigger on Account trigger event BeforeInsert|__sfdc_trigger/AccTrigger',
      '2|METHOD_ENTRY|[1]|01p000000000001|Handler.run()',
      '3|SOQL_EXECUTE_BEGIN|[4]|Aggregations:0|SELECT Id\nFROM Contact',
      '5|SOQL_EXECUTE_END|[4]|Rows:7',
      '6|DML_BEGIN|[5]|Op:Update|Type:Contact|Rows:7',
      '9|DML_END|[5]',
      '10|METHOD_EXIT|[1]|01p000000000001|Handler.run()',
      '12|CODE_UNIT_FINISHED|AccTrigger on Account trigger event BeforeInsert'
    )
    const [unit] = t.roots
    expect(unit.name).toBe('AccTrigger on Account trigger event BeforeInsert')
    expect(unit).toMatchObject({ soql: 1, dml: 1, total: 11, self: 3 })
    const method = unit.children[0]
    expect(method).toMatchObject({ name: 'Handler.run()', total: 8, self: 3 })
    expect(method.children.map(c => [c.name, c.rows, c.total])).toEqual([
      ['SELECT Id FROM Contact', 7, 2],
      ['Update Contact', 7, 3]
    ])
  })

  it('closes units left open inside a unit that ends', () => {
    // METHOD_EXIT of inner is missing.
    const t = treeOf(
      '10|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
      '20|METHOD_ENTRY|[1]||Outer.run()',
      '30|METHOD_ENTRY|[2]||Inner.run()',
      '40|METHOD_EXIT|[1]||Outer.run()',
      '50|CODE_UNIT_FINISHED|execute_anonymous_apex'
    )
    expect(t.roots.map(shape)).toEqual([
      { execute_anonymous_apex: [{ 'Outer.run()': ['Inner.run()'] }] }
    ])
    const outer = t.roots[0].children[0]
    const inner = outer.children[0]
    expect(inner).toMatchObject({ end: 40, unclosed: true, endLine: -1 })
    expect(outer).toMatchObject({ end: 40, unclosed: false, endLine: 4 })
  })

  it('ignores an end with no begin', () => {
    const t = treeOf(
      '10|METHOD_EXIT|[1]||Orphan.run()',
      '20|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
      '25|SOQL_EXECUTE_END|[1]|Rows:1',
      '30|CODE_UNIT_FINISHED|execute_anonymous_apex'
    )
    expect(t.nodes).toHaveLength(1)
    expect(t.roots[0]).toMatchObject({ total: 10, unclosed: false })
    expect(t.start).toBe(10)
  })

  it('ends units still open at the end of a truncated log', () => {
    const t = treeOf(
      '100|EXECUTION_STARTED',
      '110|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
      '120|METHOD_ENTRY|[1]||Loop.run()',
      '130|USER_DEBUG|[2]|DEBUG|still going',
      '*** Skipped 1234 bytes of detailed log'
    )
    expect(t.nodes.map(n => [n.name, n.end, n.unclosed])).toEqual([
      ['Execution', 130, true],
      ['execute_anonymous_apex', 130, true],
      ['Loop.run()', 130, true]
    ])
    expect(t.end).toBe(130)
  })

  it('nests recursion by matching each end to the nearest begin', () => {
    const t = treeOf(
      '1|METHOD_ENTRY|[1]||Fib.calc(Integer)',
      '2|METHOD_ENTRY|[3]||Fib.calc(Integer)',
      '3|METHOD_EXIT|[3]||Fib.calc(Integer)',
      '4|METHOD_ENTRY|[3]||Fib.calc(Integer)',
      '6|METHOD_EXIT|[3]||Fib.calc(Integer)',
      '7|METHOD_EXIT|[1]||Fib.calc(Integer)'
    )
    expect(t.roots).toHaveLength(1)
    expect(t.roots[0].children.map(c => c.total)).toEqual([1, 2])
    expect(t.roots[0]).toMatchObject({ total: 6, self: 3 })
  })

  it('handles an empty log and a log without units', () => {
    expect(buildExecutionTree([])).toMatchObject({
      roots: [],
      nodes: [],
      start: 0,
      end: 0
    })
    const t = treeOf('5|USER_DEBUG|[1]|DEBUG|hi', '9|USER_DEBUG|[2]|DEBUG|bye')
    expect(t.nodes).toEqual([])
    expect([t.start, t.end]).toEqual([5, 9])
  })

  it('builds a deep, unbalanced log without overflowing the stack', () => {
    const entries = Array.from(
      { length: 50000 },
      (_, i) => `${i + 1}|METHOD_ENTRY|[1]||Deep.call()`
    )
    const t = treeOf(...entries)
    expect(t.nodes).toHaveLength(50000)
    expect(t.maxDepth).toBe(49999)
    expect(t.nodes.every(n => n.unclosed && n.end === 50000)).toBe(true)
    expect(visibleNodes(t.roots, allExpandable(t))).toHaveLength(50000)
    expect(timelineBars(t.roots, 0, 50000, 1000).length).toBeGreaterThan(0)
  })
})

describe('unitName', () => {
  const name = (event: string, rest: string, kind = 'method') =>
    unitName(kind as never, event, `12:00:00.000 (1)|${event}|${rest}`)

  it('names each kind of unit', () => {
    expect(name('METHOD_ENTRY', '[1]|01p5g00000AbCdE|MyClass.run()')).toBe(
      'MyClass.run()'
    )
    expect(
      name(
        'CONSTRUCTOR_ENTRY',
        '[1]|01p5g00000AbCdE|<init>(String)|MyClass',
        'constructor'
      )
    ).toBe('new MyClass(String)')
    expect(
      name(
        'CALLOUT_REQUEST',
        '[9]|System.HttpRequest[Endpoint=https://api.example.com/x, Method=POST]',
        'callout'
      )
    ).toBe('POST https://api.example.com/x')
    expect(name('FLOW_START_INTERVIEW_BEGIN', '3e5b-1|My Flow', 'flow')).toBe(
      'My Flow'
    )
    expect(
      name('FLOW_ELEMENT_BEGIN', '3e5b-1|FlowDecision|Check', 'flowElement')
    ).toBe('FlowDecision Check')
    expect(name('SOSL_EXECUTE_BEGIN', '[3]|FIND :term', 'sosl')).toBe(
      'FIND :term'
    )
    expect(name('EXECUTION_STARTED', '', 'execution')).toBe('Execution')
    // Nothing to name it by: the event type.
    expect(name('METHOD_ENTRY', '[1]')).toBe('METHOD_ENTRY')
  })

  it('shortens very long names', () => {
    const long = 'x'.repeat(1000)
    expect(name('METHOD_ENTRY', `[1]|${long}`)).toHaveLength(300)
  })
})

describe('tree view helpers', () => {
  const t = treeOf(
    '1|CODE_UNIT_STARTED|[EXTERNAL]|A',
    '2|METHOD_ENTRY|[1]||B',
    '3|METHOD_ENTRY|[2]||C',
    '4|METHOD_EXIT|[2]||C',
    '5|METHOD_EXIT|[1]||B',
    '6|METHOD_ENTRY|[3]||D',
    '7|METHOD_EXIT|[3]||D',
    '8|CODE_UNIT_FINISHED|A'
  )

  it('lists the nodes under expanded nodes, in order', () => {
    const names = (ids: number[]) =>
      visibleNodes(t.roots, new Set(ids)).map(n => n.name)
    expect(names([])).toEqual(['A'])
    expect(names([0])).toEqual(['A', 'B', 'D'])
    expect(names([0, 1])).toEqual(['A', 'B', 'C', 'D'])
    // A collapsed parent hides its expanded children.
    expect(names([1])).toEqual(['A'])
  })

  it('expands to a depth, or everything', () => {
    expect([...expandedToDepth(t, 1)]).toEqual([0])
    expect([...allExpandable(t)]).toEqual([0, 1])
  })

  it('lays out the timeline, skipping units too narrow to see', () => {
    const bars = timelineBars(t.roots, 1, 8, 700)
    expect(bars.map(b => [b.node.name, b.x, b.width])).toEqual([
      ['A', 0, 700],
      ['B', 100, 300],
      ['C', 200, 100],
      ['D', 500, 100]
    ])
    // Zoomed into B: A and B overlap the window, D doesn't.
    expect(timelineBars(t.roots, 2, 5, 300).map(b => b.node.name)).toEqual([
      'A',
      'B',
      'C'
    ])
    // At 7 px for the whole run, only A is 4 px wide.
    expect(timelineBars(t.roots, 1, 8, 7, 4).map(b => b.node.name)).toEqual([
      'A'
    ])
  })
})

describe('formatNanos', () => {
  it('picks a unit', () => {
    expect(formatNanos(512)).toBe('512 ns')
    expect(formatNanos(850_000)).toBe('850 µs')
    expect(formatNanos(1_234_567)).toBe('1.23 ms')
    expect(formatNanos(12_340_000)).toBe('12.3 ms')
    expect(formatNanos(2_000_000)).toBe('2 ms')
    expect(formatNanos(1_500_000_000)).toBe('1.5 s')
  })
})

describe('rowForLine', () => {
  const lines = [0, 1, 4, 9].map(number => ({ number }) as never)
  it('finds the row showing a line, or the next one shown', () => {
    expect(rowForLine(lines, 4)).toBe(2)
    expect(rowForLine(lines, 5)).toBe(3)
    expect(rowForLine(lines, 12)).toBe(3)
    expect(rowForLine([], 3)).toBe(-1)
  })
})

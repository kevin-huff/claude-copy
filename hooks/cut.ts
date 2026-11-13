import type { PNode, PandocDoc, Path, Spot } from '../types'

type Step = number | 'c'
type ListFn = (list: readonly PNode[], at: Path) => PNode[]

const LEAVES = new Set(['Str', 'Code', 'Math', 'RawInline'])
const GAPS = new Set(['Space', 'SoftBreak', 'LineBreak'])
const BETWEEN_ONLY = new Set(['Space', 'SoftBreak', 'LineBreak', 'HorizontalRule', 'Note'])
const SIMPLE = new Set([
  'Para',
  'Plain',
  'BlockQuote',
  'Emph',
  'Strong',
  'Strikeout',
  'Underline',
  'Superscript',
  'Subscript',
  'SmallCaps',
])
const ATTR_FIRST = new Set(['Div', 'Quoted', 'Cite', 'Span'])
const TARGETED = new Set(['Link', 'Image'])
const CONTAINERS = new Set([
  ...SIMPLE,
  ...ATTR_FIRST,
  ...TARGETED,
  'Header',
  'BulletList',
  'OrderedList',
  'DefinitionList',
  'LineBlock',
])
const BLOCKS = new Set([
  'Para',
  'Plain',
  'Header',
  'BlockQuote',
  'BulletList',
  'OrderedList',
  'DefinitionList',
  'LineBlock',
  'Div',
  'CodeBlock',
  'RawBlock',
  'HorizontalRule',
  'Table',
  'Null',
])

function isNode(value: unknown): value is PNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as PNode).t === 'string'
}

function compare(a: Path, b: Path): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1
    return x === 'c' ? -1 : 1
  }
  return a.length - b.length
}

function isPrefix(a: Path, b: Path): boolean {
  return a.length <= b.length && a.every((step, i) => step === b[i])
}

function same(a: Path, b: Path): boolean {
  return a.length === b.length && isPrefix(a, b)
}

function walk(value: unknown, at: Path, visit: (node: PNode, at: Path) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, [...at, i], visit))
  } else if (isNode(value)) {
    visit(value, at)
    walk(value.c, [...at, 'c'], visit)
  }
}

function textOf(node: PNode): string {
  if (node.t === 'Str') return typeof node.c === 'string' ? node.c : ''
  return Array.isArray(node.c) && typeof node.c[1] === 'string' ? node.c[1] : ''
}

function withText(node: PNode, text: string): PNode {
  if (node.t === 'Str') return { t: 'Str', c: text }
  return { t: node.t, c: [structuredClone(node.c[0]), text] }
}

function hasContent(node: PNode): boolean {
  if (node.t === 'Table' || node.t === 'HorizontalRule' || node.t === 'Image') return true
  if (LEAVES.has(node.t) || node.t === 'CodeBlock' || node.t === 'RawBlock') return textOf(node) !== ''
  let found = false
  walk(node.c, [], (inner) => {
    if (!found && hasContent(inner)) found = true
  })
  return found
}

function rebuild(node: PNode, at: Path, f: ListFn): PNode | null {
  const c = node.c
  const sub = (...steps: Step[]): Path => [...at, 'c', ...steps]
  const t = node.t
  if (SIMPLE.has(t)) {
    const kids = f(c ?? [], sub())
    return kids.length ? { t, c: kids } : null
  }
  if (ATTR_FIRST.has(t)) {
    const kids = f(c[1], sub(1))
    return kids.length ? { t, c: [structuredClone(c[0]), kids] } : null
  }
  if (TARGETED.has(t)) {
    const kids = f(c[1], sub(1))
    if (!kids.length && !(t === 'Image' && c[1].length === 0)) return null
    return { t, c: [structuredClone(c[0]), kids, structuredClone(c[2])] }
  }
  if (t === 'Header') {
    const kids = f(c[2], sub(2))
    return kids.length ? { t, c: [c[0], structuredClone(c[1]), kids] } : null
  }
  if (t === 'BulletList' || t === 'LineBlock') {
    const items = (c as PNode[][]).map((item, i) => f(item, sub(i))).filter((item) => item.length > 0)
    return items.length ? { t, c: items } : null
  }
  if (t === 'OrderedList') {
    const items = (c[1] as PNode[][])
      .map((item, i) => ({ i, kids: f(item, sub(1, i)) }))
      .filter((item) => item.kids.length > 0)
    const first = items[0]
    if (!first) return null
    const [start, style, delim] = c[0]
    return { t, c: [[start + first.i, structuredClone(style), structuredClone(delim)], items.map((item) => item.kids)] }
  }
  if (t === 'DefinitionList') {
    const items = (c as [PNode[], PNode[][]][])
      .map(([term, defs], i) => [
        f(term, sub(i, 0)),
        defs.map((def, k) => f(def, sub(i, 1, k))).filter((def) => def.length > 0),
      ] as [PNode[], PNode[][]])
      .filter(([term, defs]) => term.length > 0 || defs.length > 0)
    return items.length ? { t, c: items } : null
  }
  return structuredClone(node)
}

function trimLeaf(node: PNode, at: Path, start: Spot, end: Spot): PNode | null {
  const text = textOf(node)
  const from = same(at, start.path) ? start.offset : 0
  let to = text.length
  if (same(at, end.path)) {
    const point = text.codePointAt(end.offset)
    to = end.offset + (point !== undefined && point > 0xffff ? 2 : 1)
  }
  const kept = text.slice(Math.max(0, from), Math.min(text.length, to))
  return kept ? withText(node, kept) : null
}

function trimCode(node: PNode, at: Path, start: Spot, end: Spot): PNode | null {
  const text = textOf(node)
  const trailing = text.endsWith('\n')
  const lines = (trailing ? text.slice(0, -1) : text).split('\n')
  const lineAt = (offset: number) => Math.min(lines.length - 1, text.slice(0, Math.max(0, offset)).split('\n').length - 1)
  const first = same(at, start.path) ? lineAt(start.offset) : 0
  const last = same(at, end.path) ? lineAt(end.offset) : lines.length - 1
  if (last < first) return null
  const kept = lines.slice(first, last + 1).join('\n') + (trailing ? '\n' : '')
  return { t: 'CodeBlock', c: [structuredClone(node.c[0]), kept] }
}

function isList(node: PNode | undefined): node is PNode {
  return node?.t === 'BulletList' || node?.t === 'OrderedList'
}

function innerOfWrapper(node: PNode): PNode | null {
  if (!isList(node)) return null
  const items = (node.t === 'OrderedList' ? node.c[1] : node.c) as PNode[][]
  const only = items.length === 1 && items[0]!.length === 1 ? items[0]![0] : undefined
  return isList(only) ? only : null
}

function collapseWrappers(node: PNode): PNode {
  let current = node
  for (let inner = innerOfWrapper(current); inner; inner = innerOfWrapper(current)) current = inner
  return current
}

function cleanList(list: readonly PNode[]): PNode[] {
  const kept: PNode[] = []
  for (const node of list) {
    const rebuilt = CONTAINERS.has(node.t) ? rebuild(node, [], cleanList) : node
    const next = rebuilt && collapseWrappers(rebuilt)
    if (!next) continue
    if (BLOCKS.has(next.t) && !hasContent(next)) continue
    kept.push(next)
  }
  while (kept.length && GAPS.has(kept[0]!.t)) kept.shift()
  while (kept.length && GAPS.has(kept[kept.length - 1]!.t)) kept.pop()
  return kept
}

export function cutTree(doc: PandocDoc, start: Spot, end: Spot): PandocDoc {
  const inRange = (at: Path) => compare(at, start.path) >= 0 && compare(at, end.path) <= 0

  const cutNode = (node: PNode, at: Path): PNode | null => {
    const touches = isPrefix(at, start.path) || isPrefix(at, end.path)
    if (!touches) {
      if (compare(at, start.path) < 0 || compare(at, end.path) > 0) return null
      return structuredClone(node)
    }
    if (BETWEEN_ONLY.has(node.t)) return null
    if (LEAVES.has(node.t)) return trimLeaf(node, at, start, end)
    if (node.t === 'CodeBlock') return trimCode(node, at, start, end)
    if (node.t === 'Table') return structuredClone(node)
    if (CONTAINERS.has(node.t)) return rebuild(node, at, cutList)
    let hit = false
    walk(node.c, [...at, 'c'], (inner, innerAt) => {
      if (!hit && (LEAVES.has(inner.t) || inner.t === 'CodeBlock') && inRange(innerAt)) hit = true
    })
    return hit ? structuredClone(node) : null
  }

  const cutList: ListFn = (list, at) =>
    list.map((node, i) => cutNode(node, [...at, i])).filter((node): node is PNode => node !== null)

  return {
    'pandoc-api-version': [...doc['pandoc-api-version']],
    meta: structuredClone(doc.meta),
    blocks: cleanList(cutList(doc.blocks, [])),
  }
}

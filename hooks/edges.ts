import type { PandocDoc, PNode, Path, Spot } from '../types'

const TEXT_AT_C1 = new Set(['Code', 'CodeBlock', 'Math', 'RawInline'])
const GAPS = new Set(['Space', 'SoftBreak', 'LineBreak'])
const INLINE_BLOCKS = new Set(['Para', 'Plain', 'Header'])
const SPACE = /\s/u

type Item = { kind: 'leaf'; path: Path; text: string } | { kind: 'gap' } | { kind: 'wall' }

function isNode(value: unknown): value is PNode {
  return typeof value === 'object' && value !== null && typeof (value as PNode).t === 'string'
}

function leafText(node: PNode): string | null {
  if (node.t === 'Str') return typeof node.c === 'string' ? node.c : null
  if (TEXT_AT_C1.has(node.t) && Array.isArray(node.c) && typeof node.c[1] === 'string') return node.c[1]
  return null
}

function valueAt(doc: PandocDoc, path: Path): unknown {
  let cur: any = doc.blocks
  for (const step of path) {
    if (cur === null || cur === undefined) return undefined
    cur = step === 'c' ? cur.c : cur[step]
  }
  return cur
}

function blockOf(doc: PandocDoc, path: Path): { value: unknown; at: Path } {
  const own = valueAt(doc, path)
  if (isNode(own) && own.t === 'CodeBlock') return { value: own, at: path }
  for (let k = path.length; k >= 0; k--) {
    const node = valueAt(doc, path.slice(0, k))
    if (isNode(node) && INLINE_BLOCKS.has(node.t)) return { value: node, at: path.slice(0, k) }
    if (isNode(node) && node.t === 'LineBlock' && path[k] === 'c' && typeof path[k + 1] === 'number') {
      const at = path.slice(0, k + 2)
      return { value: valueAt(doc, at), at }
    }
  }
  return { value: own, at: path }
}

function flatten(value: unknown, at: Path, out: Item[]): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) flatten(value[i], [...at, i], out)
    return
  }
  if (!isNode(value)) return
  const text = leafText(value)
  if (text !== null) {
    out.push({ kind: 'leaf', path: at, text })
    return
  }
  if (GAPS.has(value.t)) {
    out.push({ kind: 'gap' })
    return
  }
  if (value.t === 'Note') {
    out.push({ kind: 'wall' })
    return
  }
  if (value.t === 'Link' || value.t === 'Image') {
    if (Array.isArray(value.c)) flatten(value.c[1], [...at, 'c', 1], out)
    return
  }
  if ('c' in value) flatten(value.c, [...at, 'c'], out)
}

type Token = { kind: 'char'; ch: string; spot: Spot } | { kind: 'gap' } | { kind: 'wall' }

function sameLeaf(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((step, i) => step === b[i])
}

function tokens(doc: PandocDoc, spot: Spot): { all: Token[]; at: number } | null {
  const { value, at } = blockOf(doc, spot.path)
  const items: Item[] = []
  if (isNode(value) && leafText(value) !== null) items.push({ kind: 'leaf', path: at, text: leafText(value) ?? '' })
  else flatten(value, at, items)
  const all: Token[] = []
  let found = -1
  for (const item of items) {
    if (item.kind !== 'leaf') {
      all.push({ kind: item.kind })
      continue
    }
    let offset = 0
    for (const ch of item.text) {
      if (sameLeaf(item.path, spot.path) && offset === spot.offset) found = all.length
      all.push({ kind: 'char', ch, spot: { path: item.path, offset } })
      offset += ch.length
    }
  }
  return found < 0 ? null : { all, at: found }
}

export function widenStart(doc: PandocDoc, spot: Spot, edge: string): Spot {
  if (edge === '') return spot
  const found = tokens(doc, spot)
  if (!found) return spot
  const wanted = Array.from(edge)
  let w = wanted.length - 1
  let result = spot
  for (let i = found.at - 1; i >= 0 && w >= 0; i--) {
    const tok = found.all[i]
    if (!tok || tok.kind === 'wall') break
    if (tok.kind === 'gap') {
      if (!SPACE.test(wanted[w] ?? 'x')) break
      while (w >= 0 && SPACE.test(wanted[w] ?? 'x')) w--
      continue
    }
    if (tok.ch !== wanted[w]) break
    if (!SPACE.test(tok.ch)) result = tok.spot
    w--
  }
  return result
}

export function widenEnd(doc: PandocDoc, spot: Spot, edge: string): Spot {
  if (edge === '') return spot
  const found = tokens(doc, spot)
  if (!found) return spot
  const wanted = Array.from(edge)
  let w = 0
  let result = spot
  for (let i = found.at + 1; i < found.all.length && w < wanted.length; i++) {
    const tok = found.all[i]
    if (!tok || tok.kind === 'wall') break
    if (tok.kind === 'gap') {
      if (!SPACE.test(wanted[w] ?? 'x')) break
      while (w < wanted.length && SPACE.test(wanted[w] ?? 'x')) w++
      continue
    }
    if (tok.ch !== wanted[w]) break
    if (!SPACE.test(tok.ch)) result = tok.spot
    w++
  }
  return result
}

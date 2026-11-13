import type { PNode } from '../types'

type Inlines = readonly PNode[]

const isNode = (x: any): x is PNode => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.t === 'string'

function inlines(list: any): string {
  if (!Array.isArray(list)) return ''
  let out = ''
  for (const node of list) out += inline(node)
  return out
}

function inline(node: PNode): string {
  if (!isNode(node)) return ''
  const c = node.c
  switch (node.t) {
    case 'Str':
      return typeof c === 'string' ? c : ''
    case 'Space':
    case 'SoftBreak':
      return ' '
    case 'LineBreak':
      return '\n'
    case 'Emph':
    case 'Strong':
    case 'Strikeout':
    case 'Underline':
    case 'Superscript':
    case 'Subscript':
    case 'SmallCaps':
      return inlines(c)
    case 'Span':
    case 'Cite':
      return inlines(c?.[1])
    case 'Quoted': {
      const text = inlines(c?.[1])
      return c?.[0]?.t === 'SingleQuote' ? `‘${text}’` : `“${text}”`
    }
    case 'Code':
    case 'Math':
      return typeof c?.[1] === 'string' ? c[1] : ''
    case 'Image':
      return inlines(c?.[1])
    case 'Link': {
      const text = inlines(c?.[1])
      const url = typeof c?.[2]?.[0] === 'string' ? c[2][0] : ''
      if (!url) return text
      if (!text.trim()) return url
      if (url === text || url === `mailto:${text}` || url.startsWith('#')) return text
      return `${text} (${url})`
    }
    case 'RawInline':
      return Array.isArray(c) && c[0] === 'html' && typeof c[1] === 'string' && /^<br\s*\/?>$/i.test(c[1]) ? '\n' : ''
    default:
      return ''
  }
}

function indent(text: string, width: number): string {
  const pad = ' '.repeat(width)
  return text
    .split('\n')
    .map((line, i) => (i === 0 || line === '' ? line : pad + line))
    .join('\n')
}

function item(blocks: any, marker: string): string {
  let text = blockList(blocks).join('\n')
  if (text.startsWith('☒')) text = '☑' + text.slice(1)
  const first = Array.isArray(blocks) && isNode(blocks[0]) ? blocks[0].t : ''
  const lead = first === 'BulletList' || first === 'OrderedList' ? ' '.repeat(marker.length) : marker
  return lead + indent(text, marker.length)
}

const isCell = (x: any) => Array.isArray(x) && x.length === 5 && Array.isArray(x[0]) && typeof x[2] === 'number' && Array.isArray(x[4])

function findRows(x: any): any[][] {
  if (!x || typeof x !== 'object') return []
  if (Array.isArray(x) && x.length === 2 && Array.isArray(x[0]) && Array.isArray(x[1]) && x[1].length > 0 && x[1].every(isCell)) return [x[1]]
  const out: any[][] = []
  for (const child of Array.isArray(x) ? x : Object.values(x)) out.push(...findRows(child))
  return out
}

function textLines(x: any): string[] {
  if (!x || typeof x !== 'object') return []
  if (isNode(x) && (x.t === 'Plain' || x.t === 'Para' || x.t === 'Header')) return [headerOrInlines(x)]
  const out: string[] = []
  for (const child of Array.isArray(x) ? x : Object.values(x)) out.push(...textLines(child))
  return out
}

function headerOrInlines(node: PNode): string {
  return node.t === 'Header' ? inlines(node.c?.[2]) : inlines(node.c)
}

const cellText = (blocks: any) => blockList(blocks).join('\n\n').replace(/\n+/g, ' ')

function table(c: any): string {
  if (Array.isArray(c) && c.length === 5 && Array.isArray(c[3]) && Array.isArray(c[4])) {
    const rows: string[][] = []
    const header = c[3].map(cellText)
    if (!header.every((cell: string) => cell.trim() === '')) rows.push(header)
    for (const row of c[4]) if (Array.isArray(row)) rows.push(row.map(cellText))
    return rows.map((row) => row.join('\t')).join('\n')
  }
  const rows = findRows(c)
  if (rows.length > 1 && rows[0]!.every((cell) => cellText(cell[4]).trim() === '')) rows.shift()
  if (rows.length) return rows.map((row) => row.map((cell) => cellText(cell[4])).join('\t')).join('\n')
  return textLines(c).join('\n')
}

function block(node: PNode): string | null {
  if (!isNode(node)) return null
  const c = node.c
  switch (node.t) {
    case 'Para':
    case 'Plain':
      return inlines(c)
    case 'Header':
      return inlines(c?.[2])
    case 'BulletList':
      return Array.isArray(c) ? c.map((blocks: any) => item(blocks, '- ')).join('\n') : null
    case 'OrderedList': {
      const start = typeof c?.[0]?.[0] === 'number' ? c[0][0] : 1
      return Array.isArray(c?.[1]) ? c[1].map((blocks: any, i: number) => item(blocks, `${start + i}. `)).join('\n') : null
    }
    case 'BlockQuote':
    case 'Div':
      return blockList(node.t === 'Div' ? c?.[1] : c).join('\n\n')
    case 'Figure':
      return blockList(c?.[2]).join('\n\n')
    case 'CodeBlock':
      return typeof c?.[1] === 'string' ? c[1].replace(/\n$/, '') : null
    case 'LineBlock':
      return Array.isArray(c) ? c.map(inlines).join('\n') : null
    case 'DefinitionList':
      if (!Array.isArray(c)) return null
      return c
        .map((entry: any) => {
          const defs = (Array.isArray(entry?.[1]) ? entry[1] : []).map((blocks: any) => '  ' + indent(blockList(blocks).join('\n'), 2))
          return [inlines(entry?.[0]), ...defs].join('\n')
        })
        .join('\n')
    case 'Table':
      return table(c)
    default:
      return null
  }
}

function blockList(blocks: any): string[] {
  if (!Array.isArray(blocks)) return []
  const out: string[] = []
  for (const b of blocks) {
    const text = block(b)
    if (text !== null && text.trim() !== '') out.push(text)
  }
  return out
}

export function toPlain(blocks: readonly PNode[]): string {
  return blockList(blocks)
    .join('\n\n')
    .split('\n')
    .map((line) => line.replace(/ +$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

const KINDS: Record<string, [string, string, string]> = {
  Para: ['paragraph', 'paragraph', 'paragraphs'],
  Plain: ['paragraph', 'paragraph', 'paragraphs'],
  LineBlock: ['paragraph', 'paragraph', 'paragraphs'],
  Header: ['heading', 'heading', 'headings'],
  BulletList: ['list', 'list', 'lists'],
  OrderedList: ['list', 'list', 'lists'],
  DefinitionList: ['list', 'list', 'lists'],
  Table: ['table', 'table', 'tables'],
  CodeBlock: ['code block', 'code block', 'code blocks'],
  BlockQuote: ['quote', 'quote', 'quotes'],
}

function tally(blocks: Inlines, counts: Map<string, [number, string, string]>) {
  for (const b of blocks) {
    if (!isNode(b)) continue
    if (b.t === 'Div') {
      tally(Array.isArray(b.c?.[1]) ? b.c[1] : [], counts)
      continue
    }
    const kind = KINDS[b.t]
    if (!kind) continue
    const seen = counts.get(kind[0])
    if (seen) seen[0]++
    else counts.set(kind[0], [1, kind[1], kind[2]])
  }
}

export function describeBlocks(blocks: readonly PNode[]): string {
  if (blocks.length === 1 && ['Para', 'Plain', 'Header', 'LineBlock'].includes(blocks[0]?.t ?? '')) {
    const words = toPlain(blocks).split(/\s+/).filter(Boolean).length
    return words === 1 ? '1 word' : `${words} words`
  }
  const counts = new Map<string, [number, string, string]>()
  tally(blocks, counts)
  const phrases = [...counts.values()].map(([n, one, many]) => (n === 1 ? `a ${one}` : `${n} ${many}`))
  if (phrases.length === 0) return 'some text'
  if (phrases.length === 1) return phrases[0] ?? 'some text'
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`
  if (phrases.length === 3) return `${phrases[0]}, ${phrases[1]} and ${phrases[2]}`
  return `${phrases.slice(0, 3).join(', ')} and more`
}

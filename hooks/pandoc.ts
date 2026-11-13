import type { EngineInterface } from 'claude-code'
import type { PandocDoc, PNode, Ran } from '../types'
import { runProgram } from './exec'

const CACHE_SIZE = 32
const trees = new Map<string, PandocDoc>()

const READER = 'gfm+hard_line_breaks-emoji'
// pandoc 3 reads footnotes, $math$, > [!NOTE] boxes and a leading --- block in gfm, and Claude Code shows them
// as typed. pandoc 2.9 knows none of these extensions for gfm and rejects the names, so they are switched off
// only when a tree holds what they make (or pandoc refused the reply), for the ones the installed pandoc turns on.
const SHOWN_AS_TYPED = ['footnotes', 'tex_math_dollars', 'tex_math_gfm', 'alerts', 'yaml_metadata_block']
const THEIR_NODES = new Set(['Note', 'Math', 'Div'])
let strict: Promise<string> | null = null

export function clearTreeCache(): void {
  trees.clear()
  strict = null
}

function strictReader($: EngineInterface): Promise<string> {
  strict ??= pandoc($, ['pandoc', '--list-extensions=gfm']).then((ran) => {
    if (!ran.ok) strict = null
    const on = new Set(ran.ok ? ran.value.split('\n').filter((l) => l.startsWith('+')).map((l) => l.slice(1).trim()) : [])
    return READER + SHOWN_AS_TYPED.filter((name) => on.has(name)).map((name) => `-${name}`).join('')
  })
  return strict
}

function holds(value: unknown, kinds: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) return value.some((v) => holds(v, kinds))
  if (!value || typeof value !== 'object') return false
  const node = value as PNode
  return (typeof node.t === 'string' && kinds.has(node.t)) || holds(node.c, kinds)
}

const isTaskList = (list: PNode): boolean =>
  Array.isArray(list.c) && list.c.some((item: any) => /^[☐☒]$/.test(item?.[0]?.c?.[0]?.c ?? ''))

// pandoc 3 splits a list that mixes task items and plain items into several lists; pandoc 2.9 keeps one.
function joinTaskLists(value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) joinTaskLists(v)
    for (let i = 0; i + 1 < value.length; ) {
      const a = value[i] as PNode | undefined
      const b = value[i + 1] as PNode | undefined
      if (a?.t === 'BulletList' && b?.t === 'BulletList' && (isTaskList(a) || isTaskList(b))) {
        a.c.push(...b.c)
        value.splice(i + 1, 1)
      } else i++
    }
  } else if (value && typeof value === 'object') joinTaskLists((value as PNode).c)
}

const isStr = (node: PNode | undefined, text: string) => node?.t === 'Str' && node.c === text

// pandoc 3 leaves '[x]' and '[ ]' at the start of a numbered item as text; pandoc 2.9 makes them task boxes.
function boxNumberedTasks(value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) boxNumberedTasks(v)
    return
  }
  if (!value || typeof value !== 'object') return
  const node = value as PNode
  if (node.t === 'OrderedList' && Array.isArray(node.c?.[1])) {
    for (const item of node.c[1]) {
      const first = Array.isArray(item) ? (item[0] as PNode | undefined) : undefined
      const inl: PNode[] | undefined = (first?.t === 'Plain' || first?.t === 'Para') && Array.isArray(first.c) ? first.c : undefined
      if (!inl || inl[1]?.t !== 'Space') continue
      if (isStr(inl[0], '[x]') || isStr(inl[0], '[X]')) inl.splice(0, 1, { t: 'Str', c: '☒' })
      else if (isStr(inl[0], '[') && isStr(inl[2], ']') && inl[3]?.t === 'Space') inl.splice(0, 3, { t: 'Str', c: '☐' })
    }
  }
  boxNumberedTasks(node.c)
}

async function pandoc($: EngineInterface, argv: readonly string[], stdin?: string): Promise<Ran<string>> {
  const ran = await runProgram($, 'pandoc', argv, stdin === undefined ? { timeoutMs: 5000 } : { stdin, timeoutMs: 5000 })
  if (!ran.ok) return ran
  return { ok: true, value: String(ran.value.stdout ?? '') }
}

const unreadable = (): Ran<never> => ({
  ok: false,
  failure: { program: 'pandoc', kind: 'failed', detail: 'unreadable pandoc output' },
})

async function read($: EngineInterface, reader: string, markdown: string): Promise<Ran<PandocDoc>> {
  const ran = await pandoc($, ['pandoc', '-f', reader, '-t', 'json'], markdown)
  if (!ran.ok) return ran
  let doc: PandocDoc
  try {
    doc = JSON.parse(ran.value)
  } catch {
    return unreadable()
  }
  if (!doc || !Array.isArray(doc.blocks)) return unreadable()
  return { ok: true, value: doc }
}

export async function toTree($: EngineInterface, markdown: string): Promise<Ran<PandocDoc>> {
  const hit = trees.get(markdown)
  if (hit) {
    trees.delete(markdown)
    trees.set(markdown, hit)
    return { ok: true, value: hit }
  }
  const first = await read($, READER, markdown)
  if (!first.ok && first.failure.kind !== 'failed') return first
  let doc: PandocDoc | null = first.ok ? first.value : null
  if (!doc || holds(doc.blocks, THEIR_NODES) || Object.keys(doc.meta ?? {}).length > 0) {
    const reader = await strictReader($)
    if (reader !== READER) {
      const again = await read($, reader, markdown)
      if (again.ok) doc = again.value
    }
  }
  if (!doc) return first
  joinTaskLists(doc.blocks)
  boxNumberedTasks(doc.blocks)
  trees.set(markdown, doc)
  while (trees.size > CACHE_SIZE) trees.delete(trees.keys().next().value as string)
  return { ok: true, value: doc }
}

export async function toHtml($: EngineInterface, doc: PandocDoc): Promise<Ran<string>> {
  const ran = await pandoc($, ['pandoc', '-f', 'json', '-t', 'html', '--wrap=none'], JSON.stringify(doc))
  if (!ran.ok) return ran
  return { ok: true, value: ran.value.replace(/\n+$/, '') }
}

export async function toGfm($: EngineInterface, doc: PandocDoc): Promise<Ran<string>> {
  const ran = await pandoc($, ['pandoc', '-f', 'json', '-t', 'gfm+hard_line_breaks', '--wrap=none'], JSON.stringify(doc))
  if (!ran.ok) return ran
  const lines = ran.value.split('\n')
  const kept: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '<!-- end list -->' || lines[i] === '<!-- -->') {
      if (lines[i + 1] === '') i++
      continue
    }
    kept.push(lines[i] ?? '')
  }
  return { ok: true, value: kept.join('\n').replace(/\n+$/, '') }
}

export async function pandocVersion($: EngineInterface): Promise<Ran<string>> {
  const ran = await pandoc($, ['pandoc', '--version'])
  if (!ran.ok) return ran
  const match = /^pandoc\s+(\d[\w.\-]*)\s*$/.exec(ran.value.split('\n')[0] ?? '')
  if (!match) {
    return { ok: false, failure: { program: 'pandoc', kind: 'failed', detail: 'unreadable pandoc version' } }
  }
  return { ok: true, value: match[1] ?? '' }
}

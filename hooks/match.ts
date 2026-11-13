import type { Match, MatchStage, Path, PandocDoc, PNode, Spot, Trimmed } from '../types'
import { widenEnd, widenStart } from './edges'

const KEEP = /[\p{L}\p{N}]/u
const TEXT_AT_C1 = new Set(['Code', 'CodeBlock', 'Math', 'RawInline'])
const MARKER = /^([^\p{L}\p{N}\n]*)(?:\d{1,3}|[ivxlcdm]{1,6}|[IVXLCDM]{1,6}|[A-Za-z])[.)] /u
// The tree skips a raw inline <br>. Claude Code may draw that tag as a line break or as text, and a <br> inside
// code is always text, so a highlight showing a <br> is tried as drawn and then with each <br> as a line break.
const BR = /<br\s*\/?>/gi
const BR_TAG = /^<br\s*\/?>$/i
const HAS_BR = /<br\s*\/?>/i

function brShapes(text: string): string[] {
  return HAS_BR.test(text) ? [text, text.replace(BR, '\n')] : [text]
}
const WHOLE_BELOW = 48
const ANCHOR = 24
const MIN_RATIO = 0.5
const MAX_RATIO = 1.25

export function reduce(text: string): string {
  let out = ''
  for (const ch of text) {
    for (const k of ch.toLowerCase()) if (KEEP.test(k)) out += k
  }
  return out
}

function casedUnits(ch: string, lower: string, at: number, k: string): string {
  return lower.length === ch.length ? ch.slice(at, at + k.length) : k
}

function casedReduce(text: string): string {
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    let at = 0
    for (const k of lower) {
      if (KEEP.test(k)) out += casedUnits(ch, lower, at, k)
      at += k.length
    }
  }
  return out
}

function isNode(value: unknown): value is PNode {
  return typeof value === 'object' && value !== null && typeof (value as PNode).t === 'string'
}

function leafText(node: PNode): string | null {
  if (node.t === 'Str') return typeof node.c === 'string' ? node.c : null
  if (TEXT_AT_C1.has(node.t) && Array.isArray(node.c) && typeof node.c[1] === 'string') return node.c[1]
  return null
}

type Vis = { reduced: string; cased: string; spots: Spot[] }

const seen = new WeakMap<PandocDoc, Vis>()

export function visible(doc: PandocDoc): Vis {
  const known = seen.get(doc)
  if (known) return known
  const built = build(doc)
  seen.set(doc, built)
  return built
}

function build(doc: PandocDoc): Vis {
  let reduced = ''
  let cased = ''
  const spots: Spot[] = []
  const path: (number | 'c')[] = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        path.push(i)
        walk(value[i])
        path.pop()
      }
      return
    }
    if (!isNode(value)) return
    const text = leafText(value)
    if (text !== null) {
      if (value.t === 'RawInline' && BR_TAG.test(text)) return
      const at = path.slice()
      let offset = 0
      for (const ch of text) {
        const lower = ch.toLowerCase()
        let pos = 0
        for (const k of lower) {
          if (KEEP.test(k)) {
            reduced += k
            cased += casedUnits(ch, lower, pos, k)
            for (let u = 0; u < k.length; u++) spots.push({ path: at, offset })
          }
          pos += k.length
        }
        offset += ch.length
      }
      return
    }
    if ('c' in value) {
      path.push('c')
      walk(value.c)
      path.pop()
    }
  }
  walk(doc.blocks)
  return { reduced, cased, spots }
}

const TASK_BOX = /^([^\p{L}\p{N}\n[]*?(?:[-*+•] )?)\[([ xX])\] /u

export function stripListMarkers(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(MARKER, '$1').replace(TASK_BOX, (_, head, box) => head + (box === ' ' ? '☐' : '☒') + ' '))
    .join('\n')
}

function occurrences(hay: string, needle: string): number[] {
  const found: number[] = []
  let i = hay.indexOf(needle)
  while (i >= 0) {
    found.push(i)
    i = hay.indexOf(needle, i + 1)
  }
  return found
}

function firstAtLeast(sorted: readonly number[], want: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((sorted[mid] ?? 0) < want) lo = mid + 1
    else hi = mid
  }
  return lo
}

type Span = { first: number; last: number; ratio: number }

function locateExact(hay: string, needle: string, cased?: { hay: string; needle: string }): Span | null {
  const n = needle.length
  if (n < 3) return null
  let i = hay.indexOf(needle)
  if (i < 0) return null
  if (cased) {
    const same = occurrences(hay, needle).find((at) => cased.hay.slice(at, at + n) === cased.needle)
    if (same !== undefined) i = same
  }
  return { first: i, last: i + n - 1, ratio: 1 }
}

function counts(text: string, from: number, to: number): Map<string, number> {
  const seen = new Map<string, number>()
  for (let i = from; i < to; i++) {
    const ch = text[i] ?? ''
    seen.set(ch, (seen.get(ch) ?? 0) + 1)
  }
  return seen
}

function changedLetters(needle: Map<string, number>, n: number, hay: string, first: number, last: number): number {
  const span = counts(hay, first, last + 1)
  let l1 = 0
  for (const [ch, k] of needle) l1 += Math.abs(k - (span.get(ch) ?? 0))
  for (const [ch, k] of span) if (!needle.has(ch)) l1 += k
  return (l1 - Math.abs(last + 1 - first - n)) / 2
}

function locateAnchored(hay: string, needle: string): Span | null {
  const n = needle.length
  if (n < WHOLE_BELOW) return null
  const head = needle.slice(0, ANCHOR)
  const tail = needle.slice(-ANCHOR)
  const starts = occurrences(hay, head)
  if (starts.length === 0) return null
  const ends = occurrences(hay, tail)
  const wanted = counts(needle, 0, n)
  const allowed = Math.max(1, Math.floor(0.02 * n))
  let best: Span | null = null
  let bestChanged = Infinity
  let bestGap = Infinity
  for (const s of starts) {
    const k = firstAtLeast(ends, s + n - tail.length)
    for (const j of [k - 1, k]) {
      const e = ends[j]
      if (e === undefined || e < s) continue
      const last = e + tail.length - 1
      const span = last + 1 - s
      const ratio = span / n
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) continue
      const changed = changedLetters(wanted, n, hay, s, last)
      if (changed > allowed) continue
      const gap = Math.abs(span - n)
      if (changed < bestChanged || (changed === bestChanged && gap < bestGap)) {
        best = { first: s, last, ratio }
        bestChanged = changed
        bestGap = gap
      }
    }
  }
  return best
}

type Attempt = { text: string; markersStripped: boolean; marker: string }

const BLOCKS = new Set(['Para', 'Plain', 'Header', 'CodeBlock'])

function blockKey(doc: PandocDoc, path: Path): string | null {
  let cur: unknown = doc.blocks
  let key: string | null = null
  for (let i = 0; i < path.length; i++) {
    const step = path[i]
    if (cur === null || typeof cur !== 'object') return key
    cur = step === 'c' ? (cur as PNode).c : (cur as unknown[])[step as number]
    if (isNode(cur) && BLOCKS.has(cur.t)) key = path.slice(0, i + 1).join('/')
  }
  return key
}

function blocksBetween(doc: PandocDoc, vis: Vis, from: number, to: number): Set<string | null> {
  const keys = new Set<string | null>()
  for (let i = from; i <= to; i++) {
    const spot = vis.spots[i]
    if (spot) keys.add(blockKey(doc, spot.path))
  }
  return keys
}

function firstMarker(highlight: string): string {
  for (const line of highlight.split('\n')) {
    if (reduce(line).length === 0) continue
    const m = MARKER.exec(line)
    return m ? reduce(m[0].slice((m[1] ?? '').length)) : ''
  }
  return ''
}

// null in a key set is text outside any block above. An original match whose number sits in another
// block than the words after it is refused; a stripped match widens only inside one known block.
function markerSpan(doc: PandocDoc, vis: Vis, attempt: Attempt, span: Span): Span | null {
  const k = attempt.marker.length
  if (k === 0) return span
  if (!attempt.markersStripped) {
    if (vis.reduced.slice(span.first, span.first + k) !== attempt.marker) return span
    return blocksBetween(doc, vis, span.first, Math.min(span.first + k, span.last)).size > 1 ? null : span
  }
  if (span.first < k || vis.reduced.slice(span.first - k, span.first) !== attempt.marker) return span
  const keys = blocksBetween(doc, vis, span.first - k, span.first)
  return keys.size === 1 && !keys.has(null) ? { ...span, first: span.first - k } : span
}

function place(doc: PandocDoc, vis: Vis, attempt: Attempt, found: Span, trimmed: Trimmed): Match | null {
  const dropFirst = trimmed === 'first' || trimmed === 'both'
  const dropLast = trimmed === 'last' || trimmed === 'both'
  const span = dropFirst ? found : markerSpan(doc, vis, attempt, found)
  if (!span) return null
  let start = vis.spots[span.first]
  let end = vis.spots[span.last]
  if (!start || !end) return null
  const raw = attempt.text.split('\n').filter((line) => reduce(line).length > 0)
  const firstKept = dropFirst ? raw[1] : undefined
  const lastKept = dropLast ? raw[raw.length - 2] : undefined
  const head = firstKept ?? attempt.text
  const tail = lastKept ?? attempt.text
  if (!dropFirst || firstKept !== undefined) start = widenStart(doc, start, /^[^\p{L}\p{N}]*/u.exec(head)?.[0] ?? '')
  if (!dropLast || lastKept !== undefined) end = widenEnd(doc, end, /[^\p{L}\p{N}]*$/u.exec(tail)?.[0] ?? '')
  return { start, end, ratio: span.ratio, trimmed, markersStripped: attempt.markersStripped }
}

const RETRIES: readonly Trimmed[] = ['first', 'last', 'both']

function tryStage(doc: PandocDoc, vis: Vis, attempt: Attempt, stage: 'exact' | 'anchored' | 'trimmed'): Match | null {
  if (stage !== 'trimmed') {
    const needle = reduce(attempt.text)
    const span =
      stage === 'exact'
        ? locateExact(vis.reduced, needle, { hay: vis.cased, needle: casedReduce(attempt.text) })
        : locateAnchored(vis.reduced, needle)
    return span ? place(doc, vis, attempt, span, 'none') : null
  }
  const rawLines = attempt.text.split('\n').filter((line) => reduce(line).length > 0)
  const lines = rawLines.map(reduce)
  const alone = (line: string) => {
    if (line.length < 3) return true
    if (vis.reduced.includes(line)) return false
    const parts = pieces(line)
    let hits = 0
    for (const piece of parts) if (vis.reduced.includes(piece)) hits++
    return hits * 2 < parts.length
  }
  // Claude Code draws a prompt as '> ' and a reply's quote as '▎', so a '> ' line is the person's own
  // message unless its words are in the reply as they stand (a code line, say).
  const foreign = (at: number) => {
    const line = lines[at]
    if (line === undefined) return true
    const raw = rawLines[at] ?? ''
    if (/^> /.test(raw) && !vis.reduced.includes(line)) return true
    const bare = reduce(stripListMarkers(raw))
    if (bare !== line && bare.length > 0 && vis.reduced.includes(bare)) return false
    return alone(line) && alone(bare)
  }
  for (const trimmed of RETRIES) {
    const dropFirst = trimmed === 'first' || trimmed === 'both'
    const dropLast = trimmed === 'last' || trimmed === 'both'
    if (lines.length < (trimmed === 'both' ? 3 : 2)) continue
    if (dropFirst && !foreign(0)) continue
    if (dropLast && !foreign(lines.length - 1)) continue
    const needle = lines.slice(dropFirst ? 1 : 0, dropLast ? lines.length - 1 : lines.length).join('')
    const span = locateExact(vis.reduced, needle) ?? locateAnchored(vis.reduced, needle)
    if (!span) continue
    const m = place(doc, vis, attempt, span, trimmed)
    if (m) return m
  }
  return null
}

const STAGES: Record<MatchStage, readonly ('exact' | 'anchored' | 'trimmed')[]> = {
  exact: ['exact'],
  anchored: ['anchored'],
  trimmed: ['trimmed'],
  any: ['exact', 'anchored', 'trimmed'],
}

export function matchHighlight(doc: PandocDoc, drawn: string, stage: MatchStage = 'any'): Match | null {
  const vis = visible(doc)
  if (vis.reduced.length === 0) return null
  const tries: Attempt[] = []
  for (const highlight of brShapes(drawn)) {
    const stripped = stripListMarkers(highlight)
    const marker = stripped === highlight ? '' : firstMarker(highlight)
    tries.push({ text: highlight, markersStripped: false, marker })
    if (stripped !== highlight) tries.push({ text: stripped, markersStripped: true, marker })
  }
  for (const step of STAGES[stage] ?? STAGES.any) {
    for (const attempt of tries) {
      const m = tryStage(doc, vis, attempt, step)
      if (m) return m
    }
  }
  return null
}

function pieces(needle: string): string[] {
  if (needle.length <= 6) return [needle]
  const count = Math.min(8, Math.floor(needle.length / 6))
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const at = count === 1 ? 0 : Math.round((i * (needle.length - 6)) / (count - 1))
    out.push(needle.slice(at, at + 6))
  }
  return out
}

// The highlight with and without its '> ' prompt lines, so a long prompt caught in a drag can't hide a short reply.
export function mightContain(markdown: string, highlight: string): boolean {
  const needles = brShapes(highlight)
    .map((text) => reduce(stripListMarkers(text)))
    .filter((needle) => needle.length >= 3)
  const own = reduce(
    stripListMarkers(
      highlight
        .split('\n')
        .filter((line) => !/^> /.test(line))
        .join('\n'),
    ),
  )
  if (own.length >= 6 && !needles.includes(own)) needles.push(own)
  if (needles.length === 0) return false
  const hays = brShapes(markdown).map((text) =>
    reduce(
      text
        .replace(/^(\s*)\d{1,9}[.)](?=\s)/gm, '$1')
        .replace(/\]\([^)\s]*(?:\s+"[^"]*")?\)/g, ']')
        .replace(/^([ \t>]*(?:[-*+] )?)\[[ xX]\] /gm, '$1'),
    ),
  )
  return needles.some((needle) =>
    hays.some((hay) => {
      if (needle.length <= 6) return hay.includes(needle)
      const parts = pieces(needle)
      let hits = 0
      for (const piece of parts) if (hay.includes(piece)) hits++
      return hits * 2 >= parts.length
    }),
  )
}

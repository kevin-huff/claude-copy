import type { EngineInterface } from 'claude-code'
import type { CopyRequest, Failure, Match, MatchStage, Outcome, OutcomeKind, PandocDoc, Reason, Reply, Settings, Trimmed } from '../types'
import { writeRich, writeText } from './clipboard'
import { colorCode } from './code'
import { cutTree } from './cut'
import { styleHtml } from './html'
import { splitReplies, toolRow } from './input'
import { unwrapGrid } from './grid'
import { matchHighlight, mightContain } from './match'
import { ordinal, outcomeFor } from './outcome'
import { toGfm, toHtml, toTree } from './pandoc'
import { describeBlocks, toPlain } from './plain'
import { modVersion, stopwatch, writeRecord } from './record'

type Sel = { text: string; requestId: string | null }

type State = {
  sel: Sel | null
  reply: Reply | null
  match: Match | null
  cut: PandocDoc | null
  html: string | null
}

type Result = { kind: OutcomeKind; reason: Reason | null; what: string; text: string | null; detail?: string; trimmed?: Trimmed; markdown?: boolean }

type Watch = ReturnType<typeof stopwatch>

const encoder = new TextEncoder()

const STAGES: readonly MatchStage[] = ['exact', 'anchored', 'trimmed']

const FIND_BUDGET_MS = 700

const reasonOf = (failure: Failure): Reason => `${failure.program}-${failure.kind}` as Reason

const messageOf = (error: unknown): string => String(error instanceof Error ? error.message : error)

async function fallback($: EngineInterface, reason: Reason, text: string, what: string, detail?: string): Promise<Result> {
  const written = await writeText($, text)
  if (!written.ok) return { kind: 'nothing', reason: 'clipboard-failed', what, text: null, detail: written.failure.detail }
  return { kind: 'fallback', reason, what, text, detail }
}

async function asText($: EngineInterface, text: string, what: string): Promise<Result> {
  const written = await writeText($, text)
  if (!written.ok) return { kind: 'nothing', reason: 'clipboard-failed', what, text: null, detail: written.failure.detail }
  return { kind: 'text', reason: null, what, text }
}

async function styled($: EngineInterface, cut: PandocDoc, settings: Settings, st: State) {
  const html = await toHtml($, cut)
  if (!html.ok) return html
  const out = colorCode(styleHtml(html.value, { tableBorders: settings.tableBorders }), settings.codeColors)
  st.html = out
  return { ok: true as const, value: out }
}

async function convert(
  $: EngineInterface,
  request: CopyRequest,
  settings: Settings,
  cut: PandocDoc,
  what: string,
  sw: Watch,
  st: State,
): Promise<Result> {
  const plainFallback = async (failure: Failure) => {
    const text = toPlain(cut.blocks)
    const result = await fallback($, reasonOf(failure), text, what, failure.detail)
    sw.lap('clipboard')
    return result
  }
  if (request.variant === 'plain') {
    const text = toPlain(cut.blocks)
    sw.lap('convert')
    const result = await asText($, text, what)
    sw.lap('clipboard')
    return result
  }
  if (request.variant === 'md') {
    const gfm = await toGfm($, cut)
    sw.lap('convert')
    if (!gfm.ok) return plainFallback(gfm.failure)
    const result = await asText($, gfm.value, what)
    sw.lap('clipboard')
    return result
  }
  const html = await styled($, cut, settings, st)
  if (!html.ok) {
    sw.lap('convert')
    return plainFallback(html.failure)
  }
  if (request.variant === 'html') {
    sw.lap('convert')
    const result = await asText($, html.value, what)
    sw.lap('clipboard')
    return result
  }
  const text = toPlain(cut.blocks)
  sw.lap('convert')
  const written = await writeRich($, html.value, text)
  if (!written.ok) return plainFallback(written.failure)
  sw.lap('clipboard')
  return { kind: 'formatted', reason: null, what, text }
}

async function pipeline(
  $: EngineInterface,
  request: CopyRequest,
  settings: Settings,
  sw: Watch,
  st: State,
): Promise<Result> {
  if (request.n === null) {
    const selection = await $.ui.selection()
    if (selection && typeof selection.text === 'string' && selection.text.trim() !== '') {
      st.sel = { text: selection.text, requestId: selection.requestId ?? null }
    }
  }
  sw.lap('selection')
  const messages = await $.session.messages()
  sw.lap('messages')
  const replies = splitReplies(messages)

  const sel = st.sel
  if (sel) {
    if (toolRow(sel.requestId ?? undefined, messages)) {
      sw.lap('find')
      return fallback($, 'tool-output', sel.text, 'the highlight')
    }
    const unwrapped = unwrapGrid(sel.text)
    const texts = unwrapped === sel.text ? [sel.text] : [sel.text, unwrapped]
    const candidates = replies.filter((reply) => texts.some((t) => mightContain(reply.markdown, t)))
    const trees = new Map<Reply, PandocDoc>()
    const unreadable = new Set<Reply>()
    let refused: Failure | null = null
    const began = performance.now()
    // Past the budget no new reply is parsed. A stage that had to skip a reply ends the search, because a
    // looser stage on the newer replies could beat an exact match in an older reply it never read.
    let limited = false
    for (const stage of STAGES) {
      for (const text of texts) {
        for (const reply of candidates) {
          if (unreadable.has(reply)) continue
          let tree = trees.get(reply)
          if (!tree) {
            if (performance.now() - began >= FIND_BUDGET_MS) {
              limited = true
              continue
            }
            const got = await toTree($, reply.markdown)
            if (!got.ok) {
              // A missing or hung pandoc ends the search; pandoc refusing one reply only skips that reply.
              if (got.failure.kind !== 'failed') {
                sw.lap('find')
                return fallback($, reasonOf(got.failure), sel.text, 'the highlight', got.failure.detail)
              }
              refused ??= got.failure
              unreadable.add(reply)
              continue
            }
            tree = got.value
            trees.set(reply, tree)
          }
          const match = matchHighlight(tree, text, stage)
          if (!match) continue
          st.reply = reply
          st.match = match
          sw.lap('find')
          st.cut = cutTree(tree, match.start, match.end)
          sw.lap('cut')
          const converted = await convert($, request, settings, st.cut, describeBlocks(st.cut.blocks), sw, st)
          if (converted.kind === 'formatted' || converted.kind === 'text') converted.trimmed = match.trimmed
          return converted
        }
      }
      if (limited) break
    }
    sw.lap('find')
    if (limited) return fallback($, 'search-limit', sel.text, 'the highlight')
    if (refused) return fallback($, reasonOf(refused), sel.text, 'the highlight', refused.detail)
    return fallback($, 'no-match', sel.text, 'the highlight')
  }

  const n = request.n ?? 1
  const what = n >= 2 ? `the ${ordinal(n)}-last reply` : 'the last reply'
  const reply = replies[n - 1]
  if (!reply) return { kind: 'nothing', reason: 'no-reply', what, text: null }
  st.reply = reply
  if (request.variant === 'md') {
    sw.lap('find')
    const result = await asText($, reply.markdown, what)
    sw.lap('clipboard')
    return result
  }
  const tree = await toTree($, reply.markdown)
  sw.lap('find')
  if (!tree.ok) return { ...(await fallback($, reasonOf(tree.failure), reply.markdown, what, tree.failure.detail)), markdown: true }
  st.cut = tree.value
  sw.lap('cut')
  return convert($, request, settings, st.cut, what, sw, st)
}

async function rescue($: EngineInterface, st: State, detail: string): Promise<Result> {
  let best: string | null = null
  if (st.cut) {
    try {
      best = toPlain(st.cut.blocks)
    } catch {
      best = null
    }
  }
  best = best || st.sel?.text || st.reply?.markdown || null
  const what = 'the highlight'
  if (!best) return { kind: 'nothing', reason: 'error', what, text: null, detail }
  try {
    const written = await writeText($, best)
    if (written.ok) return { kind: 'fallback', reason: 'error', what, text: best, detail }
  } catch {}
  return { kind: 'nothing', reason: 'error', what, text: null, detail }
}

export async function runCopy($: EngineInterface, request: CopyRequest, settings: Settings): Promise<Outcome> {
  const sw = stopwatch()
  const st: State = { sel: null, reply: null, match: null, cut: null, html: null }
  let result: Result
  try {
    result = await pipeline($, request, settings, sw, st)
  } catch (error) {
    result = await rescue($, st, messageOf(error))
  }
  const outcome = outcomeFor({
    kind: result.kind,
    variant: request.variant,
    reason: result.reason,
    what: result.what,
    n: request.n,
    detail: result.detail,
    busy: request.busy,
    fullscreen: request.fullscreen,
    trimmed: result.trimmed,
    markdown: result.markdown,
  })
  try {
    $.ui.toast(outcome.toast)
  } catch {}
  let summary: string | null = null
  try {
    summary = st.cut ? describeBlocks(st.cut.blocks) : null
  } catch {}
  let version = ''
  try {
    version = await modVersion($)
  } catch {}
  await writeRecord($, {
    at: new Date().toISOString(),
    version,
    command: request.command,
    variant: request.variant,
    highlight: st.sel?.text ?? null,
    requestId: st.sel?.requestId ?? null,
    reply: st.reply ? { index: st.reply.index, chars: st.reply.markdown.length } : null,
    match: st.match,
    summary,
    htmlBytes: st.html === null ? null : encoder.encode(st.html).length,
    textChars: result.text === null ? null : result.text.length,
    outcome: result.kind,
    reason: result.reason,
    detail: result.detail ?? null,
    timings: sw.timings(),
  })
  return outcome
}

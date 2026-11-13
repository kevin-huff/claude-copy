// A node of pandoc's JSON tree: `t` names it, `c` holds its content. Shapes follow pandoc-types 1.20
// (pandoc 2.9); later pandoc versions add node types and reshape Table, so code walks `c` generically.
export type PNode = { t: string; c?: any }

export type PandocDoc = {
  'pandoc-api-version': number[]
  meta: Record<string, unknown>
  blocks: PNode[]
}

// Steps from doc.blocks down to a node: a number indexes the current array, 'c' enters the current
// node's content. doc.blocks[2].c[1][0][0].c[3] is [2, 'c', 1, 0, 0, 'c', 3]. Comparing two paths
// step by step gives reading order; a path that is a prefix of another is its ancestor.
export type Path = readonly (number | 'c')[]

// One character inside a leaf: the leaf's path and a UTF-16 index into the leaf's text
// (Str: c; Code, CodeBlock, Math, RawInline: c[1]).
export type Spot = { path: Path; offset: number }

export type Trimmed = 'none' | 'first' | 'last' | 'both'

// Which match tries to run: the whole highlight as is, a long highlight by its anchors, line-trimmed retries, or all three in that order.
export type MatchStage = 'exact' | 'anchored' | 'trimmed' | 'any'

export type Match = {
  start: Spot // first matched character, inclusive
  end: Spot // last matched character, inclusive: the index where its code point starts
  ratio: number // the matched span's reduced length divided by the highlight's
  trimmed: Trimmed // highlight lines dropped before the match was found
  markersStripped: boolean // whether ordered-list markers were removed from the highlight
}

// A test fixture: an invented reply, pandoc 2.9.2.1's tree for it, and a highlight as Claude Code draws it.
export type MatchCase = { name: string; markdown: string; doc: PandocDoc; highlight: string; shouldMatch: boolean }

// Claude's text between two prompts. index 1 is the newest.
export type Reply = { index: number; markdown: string }

export type Variant = 'rich' | 'md' | 'plain' | 'html'

export type Settings = { defaultVariant: Variant; tableBorders: boolean; codeColors: boolean }

export type Parsed =
  | { kind: 'copy'; n: number | null; variant: Variant | null }
  | { kind: 'help' }
  | { kind: 'doctor' }
  | { kind: 'bad'; word: string }

export type CopyRequest = {
  n: number | null // null: the highlight, or the last reply when nothing is highlighted
  variant: Variant
  command: string // as typed, for the run record, e.g. '/rcopy 2 md'
  busy: boolean // a main-conversation turn is in flight
  fullscreen: boolean // e.presentation.isFullscreen
}

export type ProgramName = 'pandoc' | 'powershell'

export type Failure = { program: ProgramName; kind: 'missing' | 'failed' | 'timeout'; detail: string }

export type Ran<T> = { ok: true; value: T } | { ok: false; failure: Failure }

export type Reason =
  | 'tool-output'
  | 'no-match'
  | 'search-limit'
  | 'no-reply'
  | 'pandoc-missing'
  | 'pandoc-failed'
  | 'pandoc-timeout'
  | 'powershell-missing'
  | 'powershell-failed'
  | 'powershell-timeout'
  | 'clipboard-failed'
  | 'error'

// formatted: HTML plus text written. text: a text-only variant written. fallback: plain text written
// after a failure. nothing: the clipboard was left alone.
export type OutcomeKind = 'formatted' | 'text' | 'fallback' | 'nothing'

export type OutcomeInput = {
  kind: OutcomeKind
  variant: Variant
  reason: Reason | null
  what: string // e.g. '12 words', '2 paragraphs and a table', 'the last reply', 'the highlight'
  n?: number | null
  detail?: string
  busy?: boolean
  fullscreen?: boolean
  trimmed?: Trimmed // highlight lines left out of the match
  markdown?: boolean // a fallback wrote the reply's Markdown source
}

export type Outcome = { kind: OutcomeKind; variant: Variant; reason: Reason | null; what: string; toast: string }

export type Timings = Record<string, number>

export type RunRecord = {
  at: string
  version: string
  command: string
  variant: Variant
  highlight: string | null
  requestId: string | null
  reply: { index: number; chars: number } | null
  match: Match | null
  summary: string | null
  htmlBytes: number | null
  textChars: number | null
  outcome: OutcomeKind
  reason: Reason | null
  detail: string | null
  timings: Timings
}

export type Check = { name: string; ok: boolean; detail: string; fix: string | null }

export type Binding = { context: string; key: string; action: string }

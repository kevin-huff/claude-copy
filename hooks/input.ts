import type { SessionMessage } from 'claude-code'
import type { Parsed, Reply, Settings, Variant } from '../types'

const VARIANTS: Record<string, Variant> = {
  rich: 'rich',
  formatted: 'rich',
  md: 'md',
  markdown: 'md',
  plain: 'plain',
  text: 'plain',
  html: 'html',
}

export function parseArgs(args: string): Parsed {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { kind: 'copy', n: null, variant: null }
  const lower = tokens.map((t) => t.toLowerCase())
  if (tokens.length === 1 && lower[0] === 'help') return { kind: 'help' }
  if (tokens.length === 1 && lower[0] === 'doctor') return { kind: 'doctor' }
  let n: number | null = null
  let variant: Variant | null = null
  for (const [i, token] of tokens.entries()) {
    const word = lower[i]!
    if (/^\d{1,3}$/.test(word)) {
      const num = Number(word)
      if (num < 1 || n !== null) return { kind: 'bad', word: token }
      n = num
    } else if (Object.hasOwn(VARIANTS, word)) {
      if (variant !== null) return { kind: 'bad', word: token }
      variant = VARIANTS[word]!
    } else {
      return { kind: 'bad', word: token }
    }
  }
  return { kind: 'copy', n, variant }
}

export function settingsFrom(options: Readonly<Record<string, unknown>>): Settings {
  const v = options.defaultVariant
  return {
    defaultVariant: v === 'rich' || v === 'md' || v === 'plain' || v === 'html' ? v : 'rich',
    tableBorders: typeof options.tableBorders === 'boolean' ? options.tableBorders : true,
    codeColors: typeof options.codeColors === 'boolean' ? options.codeColors : true,
  }
}

const NOT_PROMPTS = ['<command-', '<local-command-', '<system-reminder>', '<bash-', '<task-notification', '[Request interrupted']

function startsReply(m: SessionMessage): boolean {
  if (m.role !== 'user') return false
  const t = m.text.trim()
  if (t === '') return false
  return !NOT_PROMPTS.some((p) => t.startsWith(p))
}

export function splitReplies(messages: readonly SessionMessage[]): Reply[] {
  const groups: string[][] = [[]]
  for (const m of messages) {
    if (startsReply(m)) groups.push([])
    else if (m.role === 'assistant' && m.text.trim() !== '') groups[groups.length - 1]!.push(m.text)
  }
  const out: string[] = []
  for (const g of groups) {
    const markdown = g.join('\n\n')
    if (markdown.trim() !== '') out.push(markdown)
  }
  return out.reverse().map((markdown, i) => ({ index: i + 1, markdown }))
}

export function toolRow(requestId: string | undefined, messages: readonly SessionMessage[]): boolean {
  if (requestId === undefined) return false
  if (requestId.startsWith('toolu_')) return true
  return messages.some(
    (m) =>
      (m.toolUses ?? []).some((t) => t.tool_use_id === requestId) ||
      (m.toolResults ?? []).some((t) => t.tool_use_id === requestId),
  )
}

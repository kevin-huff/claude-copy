import type { Outcome, OutcomeInput, Reason } from '../types'

export const ordinal = (n: number): string => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

const fallbackWhy = (reason: Reason | null, busy: boolean, detail: string): string => {
  switch (reason) {
    case 'tool-output':
      return "formatting only applies to Claude's replies"
    case 'no-match':
      return `that highlight isn't in a reply I can read${busy ? '. Try again when Claude finishes' : ''}`
    case 'search-limit':
      return "that highlight isn't in the newest replies"
    case 'pandoc-missing':
      return "pandoc isn't installed (sudo apt install pandoc)"
    case 'pandoc-failed':
      return 'pandoc failed. Run /rcopy doctor'
    case 'pandoc-timeout':
      return 'pandoc took over 5 seconds. Try again'
    case 'powershell-missing':
      return "Windows PowerShell wasn't found. Run /rcopy doctor"
    case 'powershell-failed':
      return 'the Windows clipboard refused the formatted copy. Try again'
    case 'powershell-timeout':
      return 'PowerShell took over 5 seconds. Try again'
    default:
      return detail ? `something went wrong (${detail})` : 'something went wrong'
  }
}

const toastFor = (input: OutcomeInput): string => {
  const detail = (input.detail ?? '').slice(0, 50)
  const busy = input.busy === true
  const noN = input.n === null || input.n === undefined
  const suffix = input.fullscreen === false && noN ? ' (highlights need full-screen mode)' : ''
  const note = input.trimmed === 'both' ? ' (left out 2 lines from outside the reply)' : input.trimmed === 'first' || input.trimmed === 'last' ? ' (left out a line from outside the reply)' : ''
  if (input.kind === 'formatted') return `Copied ${input.what} with formatting${note}${suffix}`
  if (input.kind === 'text') {
    const as = input.variant === 'md' ? 'Markdown' : input.variant === 'html' ? 'HTML source' : 'plain text'
    return `Copied ${input.what} as ${as}${note}${suffix}`
  }
  if (input.kind === 'fallback') return `Copied as ${input.markdown === true ? 'Markdown' : 'plain text'}: ${fallbackWhy(input.reason, busy, detail)}`
  switch (input.reason) {
    case 'no-reply':
      return typeof input.n === 'number' && input.n >= 2
        ? `Nothing copied: there is no ${ordinal(input.n)}-last reply`
        : 'Nothing copied: no Claude reply yet'
    case 'clipboard-failed':
      return 'Nothing copied: the clipboard write failed. Run /rcopy doctor'
    default:
      return `Nothing copied: ${detail || 'something went wrong'}`
  }
}

export function outcomeFor(input: OutcomeInput): Outcome {
  return { kind: input.kind, variant: input.variant, reason: input.reason, what: input.what, toast: toastFor(input) }
}

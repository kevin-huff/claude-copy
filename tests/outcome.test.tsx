import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import type { OutcomeInput, Reason, RunRecord } from '../types'
import { ordinal, outcomeFor } from '../hooks/outcome'
import { modVersion, readRecord, recordPath, stopwatch, writeRecord } from '../hooks/record'

const base: OutcomeInput = { kind: 'formatted', variant: 'rich', reason: null, what: '12 words' }
const toast = (over: Partial<OutcomeInput>) => outcomeFor({ ...base, ...over }).toast

const fakeEnv = (vars: Record<string, string>, extra: Record<string, unknown> = {}) =>
  ({ env: { get: (name: string) => vars[name] }, plugin: { root: '/plugins/claude-copy' }, ...extra }) as unknown as EngineInterface

const record = { at: 'now', version: '0.1.0', command: '/rcopy', variant: 'rich', outcome: 'formatted', timings: {} } as unknown as RunRecord

const table: [Partial<OutcomeInput>, string][] = [
  [{}, 'Copied 12 words with formatting'],
  [{ kind: 'text', variant: 'md' }, 'Copied 12 words as Markdown'],
  [{ kind: 'text', variant: 'plain' }, 'Copied 12 words as plain text'],
  [{ kind: 'text', variant: 'html' }, 'Copied 12 words as HTML source'],
  [{ kind: 'fallback', reason: 'tool-output' }, "Copied as plain text: formatting only applies to Claude's replies"],
  [{ kind: 'fallback', reason: 'no-match' }, "Copied as plain text: that highlight isn't in a reply I can read"],
  [{ kind: 'fallback', reason: 'search-limit' }, "Copied as plain text: that highlight isn't in the newest replies"],
  [{ kind: 'fallback', reason: 'no-match', busy: true }, "Copied as plain text: that highlight isn't in a reply I can read. Try again when Claude finishes"],
  [{ kind: 'fallback', reason: 'pandoc-missing' }, "Copied as plain text: pandoc isn't installed (sudo apt install pandoc)"],
  [{ kind: 'fallback', reason: 'pandoc-failed' }, 'Copied as plain text: pandoc failed. Run /rcopy doctor'],
  [{ kind: 'fallback', reason: 'pandoc-timeout' }, 'Copied as plain text: pandoc took over 5 seconds. Try again'],
  [{ kind: 'fallback', reason: 'powershell-missing' }, "Copied as plain text: Windows PowerShell wasn't found. Run /rcopy doctor"],
  [{ kind: 'fallback', reason: 'powershell-failed' }, 'Copied as plain text: the Windows clipboard refused the formatted copy. Try again'],
  [{ kind: 'fallback', reason: 'powershell-timeout' }, 'Copied as plain text: PowerShell took over 5 seconds. Try again'],
  [{ kind: 'fallback', reason: 'error', detail: 'boom' }, 'Copied as plain text: something went wrong (boom)'],
  [{ kind: 'nothing', reason: 'no-reply' }, 'Nothing copied: no Claude reply yet'],
  [{ kind: 'nothing', reason: 'no-reply', n: 1 }, 'Nothing copied: no Claude reply yet'],
  [{ kind: 'nothing', reason: 'no-reply', n: 2 }, 'Nothing copied: there is no 2nd-last reply'],
  [{ kind: 'nothing', reason: 'clipboard-failed' }, 'Nothing copied: the clipboard write failed. Run /rcopy doctor'],
  [{ kind: 'nothing', reason: 'error', detail: 'bad thing' }, 'Nothing copied: bad thing'],
]

test('toast wording for every kind and reason', () => {
  for (const [over, want] of table) expect(toast(over)).toBe(want)
})

test('outcome carries kind, variant, reason and what', () => {
  const out = outcomeFor({ ...base, kind: 'fallback', reason: 'pandoc-failed', variant: 'md' })
  expect(out.kind).toBe('fallback')
  expect(out.variant).toBe('md')
  expect(out.reason).toBe('pandoc-failed')
  expect(out.what).toBe('12 words')
})

test('full-screen suffix only when not full-screen and n is unset', () => {
  expect(toast({ fullscreen: false })).toBe('Copied 12 words with formatting (highlights need full-screen mode)')
  expect(toast({ fullscreen: false, n: null })).toBe('Copied 12 words with formatting (highlights need full-screen mode)')
  expect(toast({ fullscreen: false, n: 2 })).toBe('Copied 12 words with formatting')
  expect(toast({ fullscreen: true })).toBe('Copied 12 words with formatting')
  expect(toast({ kind: 'text', variant: 'md', fullscreen: false })).toBe('Copied 12 words as Markdown (highlights need full-screen mode)')
})

test('ordinals', () => {
  const nothing = (n: number) => toast({ kind: 'nothing', reason: 'no-reply', n })
  expect(nothing(2)).toContain('no 2nd-last')
  expect(nothing(3)).toContain('no 3rd-last')
  expect(nothing(4)).toContain('no 4th-last')
  expect(nothing(11)).toContain('no 11th-last')
  expect(nothing(12)).toContain('no 12th-last')
  expect(nothing(13)).toContain('no 13th-last')
  expect(nothing(21)).toContain('no 21st-last')
  expect(nothing(22)).toContain('no 22nd-last')
})

test('trimmed note goes after the main text and before the full-screen suffix', () => {
  expect(toast({ trimmed: 'first' })).toBe('Copied 12 words with formatting (left out a line from outside the reply)')
  expect(toast({ trimmed: 'last' })).toBe('Copied 12 words with formatting (left out a line from outside the reply)')
  expect(toast({ trimmed: 'both' })).toBe('Copied 12 words with formatting (left out 2 lines from outside the reply)')
  expect(toast({ kind: 'text', variant: 'md', trimmed: 'first' })).toBe('Copied 12 words as Markdown (left out a line from outside the reply)')
  expect(toast({ trimmed: 'both', fullscreen: false })).toBe('Copied 12 words with formatting (left out 2 lines from outside the reply) (highlights need full-screen mode)')
  expect(toast({ trimmed: 'none' })).toBe('Copied 12 words with formatting')
})

test('markdown fallback and empty error detail', () => {
  expect(toast({ kind: 'fallback', reason: 'pandoc-missing', markdown: true })).toBe("Copied as Markdown: pandoc isn't installed (sudo apt install pandoc)")
  expect(toast({ kind: 'fallback', reason: 'pandoc-missing', markdown: false })).toBe("Copied as plain text: pandoc isn't installed (sudo apt install pandoc)")
  expect(toast({ kind: 'fallback', reason: 'error' })).toBe('Copied as plain text: something went wrong')
  expect(toast({ kind: 'fallback', reason: 'error', detail: '' })).toBe('Copied as plain text: something went wrong')
})

test('ordinal is exported', () => {
  expect(ordinal(1)).toBe('1st')
  expect(ordinal(2)).toBe('2nd')
  expect(ordinal(11)).toBe('11th')
  expect(ordinal(23)).toBe('23rd')
})

test('every toast is under 100 characters with no em dash', () => {
  const long = 'x'.repeat(200)
  const all = [...table.map(([over]) => ({ ...over, detail: long })), { kind: 'fallback', reason: 'error', detail: long }, { kind: 'nothing', reason: 'error', detail: long }] as Partial<OutcomeInput>[]
  for (const over of all) {
    const t = toast(over)
    if (over.reason === 'no-match' && over.busy) continue
    expect(t.length < 100).toBe(true)
    expect(t.includes('—')).toBe(false)
  }
  expect(toast({ kind: 'fallback', reason: 'error', detail: long })).toBe(`Copied as plain text: something went wrong (${'x'.repeat(50)})`)
  expect(toast({ kind: 'no' + 'thing' as 'nothing', reason: 'error' as Reason, detail: long })).toBe(`Nothing copied: ${'x'.repeat(50)}`)
})

test('recordPath prefers XDG_STATE_HOME, then HOME, then null', async () => {
  expect(await recordPath(fakeEnv({ XDG_STATE_HOME: '/state', HOME: '/home/tester' }))).toBe('/state/claude-copy/last-run.json')
  expect(await recordPath(fakeEnv({ HOME: '/home/tester' }))).toBe('/home/tester/.local/state/claude-copy/last-run.json')
  expect(await recordPath(fakeEnv({}))).toBe(null)
})

test('writeRecord writes indented JSON and never throws', async () => {
  const writes: [string, string][] = []
  const ok = fakeEnv({ HOME: '/home/tester' }, { fs: { write: async (p: string, t: string) => void writes.push([p, t]) } })
  await writeRecord(ok, record)
  expect(writes.length).toBe(1)
  expect(writes[0]![0]).toBe('/home/tester/.local/state/claude-copy/last-run.json')
  expect(writes[0]![1]).toBe(JSON.stringify(record, null, 2))
  const bad = fakeEnv({ HOME: '/home/tester' }, { fs: { write: async () => { throw new Error('disk full') } } })
  await writeRecord(bad, record)
  await writeRecord(fakeEnv({}, { fs: { write: async () => { throw new Error('no') } } }), record)
})

test('readRecord returns the record, or null on bad JSON or a missing file', async () => {
  const good = fakeEnv({ HOME: '/home/tester' }, { fs: { read: async () => JSON.stringify(record) } })
  expect((await readRecord(good))?.command).toBe('/rcopy')
  expect(await readRecord(fakeEnv({ HOME: '/h' }, { fs: { read: async () => '{nope' } }))).toBe(null)
  expect(await readRecord(fakeEnv({ HOME: '/h' }, { fs: { read: async () => { throw new Error('ENOENT') } } }))).toBe(null)
  expect(await readRecord(fakeEnv({}, { fs: { read: async () => '{}' } }))).toBe(null)
})

test('modVersion reads plugin.json, empty string on trouble', async () => {
  const paths: string[] = []
  const good = fakeEnv({}, { fs: { read: async (p: string) => (paths.push(p), '{"version":"1.2.3"}') } })
  expect(await modVersion(good)).toBe('1.2.3')
  expect(paths[0]).toBe('/plugins/claude-copy/.claude-plugin/plugin.json')
  expect(await modVersion(fakeEnv({}, { fs: { read: async () => { throw new Error('x') } } }))).toBe('')
  expect(await modVersion(fakeEnv({}, { fs: { read: async () => 'garbage' } }))).toBe('')
})

test('stopwatch records laps and a total at least as big as each', async () => {
  const sw = stopwatch()
  const spin = (ms: number) => { const t = performance.now(); while (performance.now() - t < ms); }
  spin(5)
  sw.lap('find')
  spin(5)
  sw.lap('cut')
  const t = sw.timings() as Record<string, number>
  expect('find' in t && 'cut' in t && 'total' in t).toBe(true)
  expect(t.total! >= t.find!).toBe(true)
  expect(t.total! >= t.cut!).toBe(true)
  expect(t.find! >= 4).toBe(true)
})

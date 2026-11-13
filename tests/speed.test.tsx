import { expect, test } from 'claude-code/testing'
import type { CopyRequest, PandocDoc, Settings } from '../types'
import { clearPowerShellPath } from '../hooks/clipboard'
import { runCopy } from '../hooks/copy'
import { mightContain } from '../hooks/match'
import { clearTreeCache } from '../hooks/pandoc'
import { TREES, conversation, fakeSession } from './fixtures/session'

declare const setTimeout: (callback: (...args: unknown[]) => void, ms: number) => unknown

const settings: Settings = { defaultVariant: 'rich', tableBorders: true, codeColors: true }

const req: CopyRequest = { n: null, variant: 'rich', command: '/rcopy', busy: false, fullscreen: true }

const fresh = () => {
  clearTreeCache()
  clearPowerShellPath()
}

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for NEWEST_MD.
const NEWEST_MD = 'Reply 149 of the log: check the config file before you restart the service.'
const NEWEST_DOC: PandocDoc = JSON.parse(
  '{"blocks":[{"t":"Para","c":[{"t":"Str","c":"Reply"},{"t":"Space"},{"t":"Str","c":"149"},{"t":"Space"},{"t":"Str","c":"of"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"log:"},{"t":"Space"},{"t":"Str","c":"check"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"config"},{"t":"Space"},{"t":"Str","c":"file"},{"t":"Space"},{"t":"Str","c":"before"},{"t":"Space"},{"t":"Str","c":"you"},{"t":"Space"},{"t":"Str","c":"restart"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"service."}]}],"pandoc-api-version":[1,20],"meta":{}}',
)

test('a highlight in the newest of 150 matching replies costs at most two pandoc runs', async () => {
  fresh()
  TREES[NEWEST_MD] = NEWEST_DOC
  const older = Array.from({ length: 149 }, (_, i) => `Reply ${i} of the log: check the config file before you restart the service.`)
  const s = fakeSession({
    messages: conversation([...older, NEWEST_MD]),
    selection: { text: 'check the config file before you restart' },
  })
  const outcome = await runCopy(s.$, req, settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts.length).toBe(1)
  expect(s.pandocRuns().length).toBeLessThanOrEqual(2)
  expect(s.pandocRuns()[0]!.stdin).toBe(NEWEST_MD)
})

test('the search stops after its time budget and falls back to the plain highlight', async () => {
  fresh()
  const highlight = 'check the config file twice'
  const replies = Array.from({ length: 60 }, (_, i) => `Reply ${i} says to check the config file before the restart.`)
  for (const markdown of replies) expect(mightContain(markdown, highlight)).toBe(true)
  const s = fakeSession({ messages: conversation(replies), selection: { text: highlight } })
  const run = s.$.process.run.bind(s.$.process)
  let jsonRuns = 0
  s.$.process.run = (async (argv: readonly string[], init?: Parameters<typeof run>[1]) => {
    if (argv[0] === 'pandoc' && argv[argv.indexOf('-t') + 1] === 'json') {
      jsonRuns++
      await new Promise((resolve) => setTimeout(resolve, 100))
      const words = String(init?.stdin ?? '').split(/\s+/).filter(Boolean)
      const inlines = words.flatMap((w, i) => (i === 0 ? [{ t: 'Str', c: w }] : [{ t: 'Space' }, { t: 'Str', c: w }]))
      const doc = { blocks: [{ t: 'Para', c: inlines }], 'pandoc-api-version': [1, 20], meta: {} }
      return { exitCode: 0, stdout: JSON.stringify(doc), stderr: '' }
    }
    return run(argv, init)
  }) as typeof s.$.process.run
  const began = performance.now()
  const outcome = await runCopy(s.$, req, settings)
  const elapsed = performance.now() - began
  expect(outcome.kind).toBe('fallback')
  expect(outcome.reason).toBe('search-limit')
  expect(s.toasts).toEqual(["Copied as plain text: that highlight isn't in the newest replies"])
  expect(s.copies).toEqual([highlight])
  expect(s.toasts.length).toBe(1)
  expect(jsonRuns).toBeLessThanOrEqual(10)
  expect(elapsed).toBeLessThan(2000)
})

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for the two drafts below.
const OLDER_DRAFT = "Here is the draft:\n\nHi all, the offsite moves to the lake lodge on Friday. The bus leaves at 8 from the north lot, so please be there by 7:45. Bring the signed form to the front desk.\n"
const NEWER_DRAFT = "Revised:\n\nHi all, the offsite moves to the lake lodge on Friday. The bus leaves at 9 from the north lot, so please be there by 7:45. Bring the signed form to the front desk.\n"
TREES[OLDER_DRAFT] = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"draft:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"all,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"bus\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leaves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"8\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"north\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lot,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"be\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"7:45.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Bring\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"signed\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"form\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"front\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"desk.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
TREES[NEWER_DRAFT] = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Revised:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"all,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"bus\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leaves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"9\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"north\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lot,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"be\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"7:45.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Bring\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"signed\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"form\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"front\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"desk.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

test('after a slow start the search does not take a near copy in a newer reply over the highlight', async () => {
  fresh()
  const highlight =
    'Hi all, the offsite moves to the lake lodge on Friday. The bus leaves at 8 from the north lot, so please be there by 7:45. Bring the signed form to the front desk.'
  const s = fakeSession({ messages: conversation([OLDER_DRAFT, NEWER_DRAFT]), selection: { text: highlight } })
  const run = s.$.process.run.bind(s.$.process)
  let first = true
  s.$.process.run = (async (argv: readonly string[], init?: Parameters<typeof run>[1]) => {
    if (argv[0] === 'pandoc' && first) {
      first = false
      await new Promise((resolve) => setTimeout(resolve, 750))
    }
    return run(argv, init)
  }) as typeof s.$.process.run
  const outcome = await runCopy(s.$, req, settings)
  expect(outcome.kind).toBe('fallback')
  expect(outcome.reason).toBe('search-limit')
  expect(s.copies).toEqual([highlight])
  expect(s.powershellRuns().length).toBe(0)
})

test('a reply that pandoc refuses is skipped and the copy comes from another reply', async () => {
  fresh()
  const s = fakeSession({ messages: conversation([OLDER_DRAFT, NEWER_DRAFT]), selection: { text: 'leaves at 8 from the north lot' } })
  const run = s.$.process.run.bind(s.$.process)
  s.$.process.run = (async (argv: readonly string[], init?: Parameters<typeof run>[1]) => {
    if (argv[0] === 'pandoc' && init?.stdin === NEWER_DRAFT) return { exitCode: 64, stdout: '', stderr: 'YAML parse exception' }
    return run(argv, init)
  }) as typeof s.$.process.run
  const outcome = await runCopy(s.$, req, settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts).toEqual(['Copied 7 words with formatting'])
})

test('when the only reply that could hold the highlight is refused, the toast says pandoc failed', async () => {
  fresh()
  const s = fakeSession({ messages: conversation([NEWER_DRAFT]), selection: { text: 'leaves at 9 from the north lot' } })
  const run = s.$.process.run.bind(s.$.process)
  s.$.process.run = (async (argv: readonly string[], init?: Parameters<typeof run>[1]) => {
    if (argv[0] === 'pandoc') return { exitCode: 64, stdout: '', stderr: 'YAML parse exception' }
    return run(argv, init)
  }) as typeof s.$.process.run
  const outcome = await runCopy(s.$, req, settings)
  expect(outcome.kind).toBe('fallback')
  expect(outcome.reason).toBe('pandoc-failed')
  expect(s.copies).toEqual(['leaves at 9 from the north lot'])
})

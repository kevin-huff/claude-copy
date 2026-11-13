import { expect, test } from 'claude-code/testing'
import type { CopyRequest, PandocDoc, Settings } from '../types'
import { clearPowerShellPath } from '../hooks/clipboard'
import { runCopy } from '../hooks/copy'
import { clearTreeCache } from '../hooks/pandoc'
import { TREES, decodeStdin, fakeSession } from './fixtures/session'

declare const setTimeout: (callback: (...args: unknown[]) => void, ms: number) => unknown

const settings: Settings = { defaultVariant: 'rich', tableBorders: true, codeColors: true }

const req = (over: Partial<CopyRequest> = {}): CopyRequest => ({
  n: null,
  variant: 'rich',
  command: '/rcopy',
  busy: false,
  fullscreen: true,
  ...over,
})

const fresh = () => {
  clearTreeCache()
  clearPowerShellPath()
}

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for each markdown below.
const EMOJI_MD = "Hey team :wave:\n\nThe boxes are packed and the van is booked for Saturday morning.\n\nGreat work everyone :tada:\n"
const EMOJI_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hey\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\":wave:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"boxes\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"are\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"packed\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"van\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"booked\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Saturday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"morning.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Great\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"work\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"everyone\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\":tada:\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}",
)
TREES[EMOJI_MD] = EMOJI_DOC

const TASKS_MD = "- [ ] Pack the boxes\n- [x] Call the landlord about the deposit\n- [ ] Return the keys\n"
const TASKS_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☐\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Pack\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"boxes\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Call\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"landlord\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"about\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"deposit\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☐\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Return\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"keys\"}]}]]}],\"pandoc-api-version\":[1,20],\"meta\":{}}",
)
TREES[TASKS_MD] = TASKS_DOC

const TRIP_MD = "Friday we review the plan for the lake trip and the budget.\n\nBring the signed form to the front desk.\n"
const TRIP_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Friday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"we\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"review\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"plan\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"trip\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"budget.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Bring\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"signed\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"form\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"front\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"desk.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}",
)
TREES[TRIP_MD] = TRIP_DOC

const LUNCH_MD = "Lunch is at noon on the patio.\n\nPlease reply by Friday (so we can book seats).\n"
const LUNCH_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Lunch\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"noon\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"patio.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"reply\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"(so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"we\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"can\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"seats).\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}",
)
TREES[LUNCH_MD] = LUNCH_DOC

const RELEASE_MD = "Release steps:\n\n1. Merge the branch.\n2. Run the tests.\n3. Tag it.\n\nThat covers the release for Friday.\n"
const RELEASE_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Release\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"steps:\"}]},{\"t\":\"OrderedList\",\"c\":[[1,{\"t\":\"DefaultStyle\"},{\"t\":\"Period\"}],[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Merge\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"branch.\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Run\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"tests.\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Tag\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"it.\"}]}]]]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"That\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"covers\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"release\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}"
)
TREES[RELEASE_MD] = RELEASE_DOC

const MOVE_MD = "Before the move:\n\n- [x] Book the van for Saturday morning\n- [x] Pack\n\nAll set for the weekend then.\n"
const MOVE_DOC: PandocDoc = JSON.parse(
  "{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Before\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"move:\"}]},{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"van\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Saturday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"morning\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Pack\"}]}]]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"All\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"set\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"weekend\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"then.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}"
)
TREES[MOVE_MD] = MOVE_DOC

test('a draft with emoji shortcodes on its first and last lines copies with formatting and keeps every line', async () => {
  fresh()
  const highlight = 'Hey team :wave:\n\nThe boxes are packed and the van is booked for Saturday morning.\n\nGreat work everyone :tada:'
  const s = fakeSession({ replies: [EMOJI_MD], selection: { text: highlight } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]).not.toContain('left out')
  expect(decodeStdin(s.powershellRuns()[0]!.stdin).text).toBe(highlight)
})

test('a drag that starts on a task box keeps the box and the last item', async () => {
  fresh()
  const s = fakeSession({ replies: [TASKS_MD], selection: { text: '[x] Call the landlord about the deposit\n- [ ] Return the keys' } })
  const outcome = await runCopy(s.$, req({ variant: 'plain' }), settings)
  expect(outcome.kind).toBe('text')
  expect(s.toasts.length).toBe(1)
  expect(s.copies.length).toBe(1)
  expect(s.copies[0]).toContain('Call the landlord about the deposit')
  expect(s.copies[0]).toContain('\u2610 Return the keys')
  expect(s.copies[0]).toContain('\u2611 Call')
})

test('a first line one word off a real line copies the whole highlight as plain text', async () => {
  fresh()
  const highlight = 'Monday we review the plan for the lake trip and the budget.\nBring the signed form to the front desk.'
  const s = fakeSession({ replies: [TRIP_MD], selection: { text: highlight } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('fallback')
  expect(outcome.reason).toBe('no-match')
  expect(s.toasts).toEqual(["Copied as plain text: that highlight isn't in a reply I can read"])
  expect(s.copies).toEqual([highlight])
})

test('a highlight that overshoots into a quoted question says one line was left out', async () => {
  fresh()
  const s = fakeSession({ replies: [LUNCH_MD], selection: { text: 'Please reply by Friday (so we can book seats).\n> Invented question 2' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
  const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
  expect(text.endsWith('seats).')).toBe(true)
  expect(text).not.toContain('Invented')
})

test('a short numbered last item survives the overshoot trim', async () => {
  fresh()
  const s = fakeSession({ replies: [RELEASE_MD], selection: { text: '3. Tag it.\nThat covers the release for Friday.\n> Invented question 2' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
  const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
  expect(text).toContain('Tag it.')
  expect(text).toContain('Friday.')
  expect(text).not.toContain('Invented')
})

test('the Markdown variant keeps the short numbered item and says a line was left out', async () => {
  fresh()
  const s = fakeSession({ replies: [RELEASE_MD], selection: { text: '3. Tag it.\nThat covers the release for Friday.\n> Invented question 2' } })
  const outcome = await runCopy(s.$, req({ variant: 'md' }), settings)
  expect(outcome.kind).toBe('text')
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]).toContain('a line')
  expect(s.pandocRuns().map((r) => r.argv[4])).toEqual(['json', 'gfm+hard_line_breaks'])
  const cut = s.pandocRuns()[1]!.stdin
  expect(cut).toContain('Tag')
  expect(cut).toContain('Friday.')
  expect(cut).not.toContain('Invented')
})

test('a short checked task survives the overshoot trim', async () => {
  fresh()
  const s = fakeSession({ replies: [MOVE_MD], selection: { text: '- [x] Pack\nAll set for the weekend then.\n> Invented question 2' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
  const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
  expect(text).toContain('Pack')
  expect(text).toContain('weekend')
  expect(text).not.toContain('Invented')
})

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for each markdown below.
const DRAFT_MD = "Here is a draft for the team:\n\n> Hi all, the offsite moves to the lake lodge on Friday. The bus leaves at 8 from the north lot, so please be there by 7:45. Bring the signed form to the front desk.\n>\n> Lunch is on the patio at noon, and the boat tour starts at 2. Thanks, and see you there.\n"
TREES[DRAFT_MD] = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"a\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"draft\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team:\"}]},{\"t\":\"BlockQuote\",\"c\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"all,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"bus\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leaves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"8\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"north\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lot,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"be\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"7:45.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Bring\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"signed\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"form\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"front\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"desk.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Lunch\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"patio\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"noon,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"boat\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"tour\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"starts\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"2.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Thanks,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"see\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"you\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there.\"}]}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

const TODO_MD = "- [x] Pack\n- [ ] Book the van for Saturday morning\n- [x] Call the landlord about the deposit\n"
TREES[TODO_MD] = JSON.parse("{\"blocks\":[{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Pack\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☐\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"van\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Saturday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"morning\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Call\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"landlord\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"about\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"deposit\"}]}]]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

const QUOTED_TASKS_MD = "Draft for the team:\n\n> Before Friday:\n>\n> - [x] Book the bus\n> - [ ] Print the forms\n"
TREES[QUOTED_TASKS_MD] = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Draft\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team:\"}]},{\"t\":\"BlockQuote\",\"c\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Before\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday:\"}]},{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"bus\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☐\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Print\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"forms\"}]}]]}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

const DRAFT_SHOWN =
  '▎ Hi all, the offsite moves to the lake lodge on Friday. The bus leaves at 8 from the north lot, so please be there by 7:45. Bring the signed form to the front desk.\n' +
  '▎\n' +
  '▎ Lunch is on the patio at noon, and the boat tour starts at 2. Thanks, and see you there.'

test('a draft dragged into a follow-up prompt that quotes it drops only the prompt', async () => {
  for (const prompt of ['> the boat tour starts at 3, not 2', '> Bring the signed form to the front desk - can you bold that?']) {
    fresh()
    const s = fakeSession({ replies: [DRAFT_MD], selection: { text: `${DRAFT_SHOWN}\n${prompt}` } })
    const outcome = await runCopy(s.$, req(), settings)
    expect(outcome.kind).toBe('formatted')
    expect(s.toasts.length).toBe(1)
    expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
    const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
    expect(text.startsWith('Hi all, the offsite')).toBe(true)
    expect(text.endsWith('see you there.')).toBe(true)
    expect(text).not.toContain('bold that')
    expect(text).not.toContain('not 2')
  }
})

test('a task list dragged from the reply marker keeps its short first item', async () => {
  for (const bullet of ['• ', '- ', '']) {
    fresh()
    const highlight = `⏺ ${bullet}[x] Pack\n${bullet}[ ] Book the van for Saturday morning\n${bullet}[x] Call the landlord about the deposit`
    const s = fakeSession({ replies: [TODO_MD], selection: { text: highlight } })
    const outcome = await runCopy(s.$, req(), settings)
    expect(outcome.kind).toBe('formatted')
    expect(s.toasts.length).toBe(1)
    expect(s.toasts[0]).not.toContain('left out')
    const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
    expect(text).toBe('- \u2611 Pack\n- \u2610 Book the van for Saturday morning\n- \u2611 Call the landlord about the deposit')
  }
})

test('a task list inside a block quote copies with its boxes', async () => {
  fresh()
  const s = fakeSession({ replies: [QUOTED_TASKS_MD], selection: { text: '▎ Before Friday:\n▎ • [x] Book the bus\n▎ • [ ] Print the forms' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts[0]).not.toContain('left out')
  const text = decodeStdin(s.powershellRuns()[0]!.stdin).text
  expect(text).toBe('Before Friday:\n\n- \u2611 Book the bus\n- \u2610 Print the forms')
})

test('a slow first pandoc start still lets the parsed reply reach the trimmed stage', async () => {
  fresh()
  const s = fakeSession({ replies: [LUNCH_MD], selection: { text: 'Please reply by Friday (so we can book seats).\n> Invented question 2' } })
  const run = s.$.process.run.bind(s.$.process)
  s.$.process.run = (async (argv: readonly string[], init?: Parameters<typeof run>[1]) => {
    if (argv[0] === 'pandoc' && argv.includes('json') && argv[2] !== 'json') await new Promise((resolve) => setTimeout(resolve, 750))
    return run(argv, init)
  }) as typeof s.$.process.run
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
})

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for PICK_MD.
const PICK_MD = "Pick one:\n\n1. No\n2. Yes, after lunch\n"
TREES[PICK_MD] = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Pick\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"one:\"}]},{\"t\":\"OrderedList\",\"c\":[[1,{\"t\":\"DefaultStyle\"},{\"t\":\"Period\"}],[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"No\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Yes,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"after\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lunch\"}]}]]]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

test('a drag from a long prompt into a short start of a reply still finds the reply', async () => {
  fresh()
  const s = fakeSession({ replies: [PICK_MD], selection: { text: '> Invented question 1\nPick one:\n1. No' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.toasts[0]!.endsWith('(left out a line from outside the reply)')).toBe(true)
  expect(decodeStdin(s.powershellRuns()[0]!.stdin).text).toBe('Pick one:\n\n1. No')
})

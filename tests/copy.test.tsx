import { expect, test } from 'claude-code/testing'
import type { CopyRequest, RunRecord, Settings } from '../types'
import { cfHtml, clearPowerShellPath } from '../hooks/clipboard'
import { colorCode } from '../hooks/code'
import { runCopy } from '../hooks/copy'
import { styleHtml } from '../hooks/html'
import { clearTreeCache } from '../hooks/pandoc'
import { CASES } from './fixtures/match'
import { D1_MD, D2_MD, GARDEN_MD, GFM_OUT, HTML_OUT, LATEST, OLDER, PLANS_MD, TREES, V1_MD, V2_MD, decodeStdin, failed, fakeSession, prompt, said } from './fixtures/session'

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

const SPAN = 'Here is bold and a list:\n\n• one\n• two'
const SPAN_TEXT = 'Here is bold and a list:\n\n- one\n- two'
const STYLED = colorCode(styleHtml(HTML_OUT.replace(/\n+$/, ''), { tableBorders: true }), true)

test('a highlight copies as HTML Format plus plain text through PowerShell', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Copied a paragraph and a list with formatting'])
  expect(outcome.kind).toBe('formatted')
  expect(s.copies).toEqual([])
  const ps = s.powershellRuns()
  expect(ps.length).toBe(1)
  const sent = decodeStdin(ps[0]!.stdin)
  expect(sent.payload).toBe(cfHtml(STYLED))
  expect(sent.text).toBe(SPAN_TEXT)
  const pandoc = s.pandocRuns().map((r) => r.argv.join(' '))
  expect(pandoc).toEqual(['pandoc -f gfm+hard_line_breaks-emoji -t json', 'pandoc -f json -t html --wrap=none'])
})

test('settings turn table borders and code colors off in the HTML', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN } })
  await runCopy(s.$, req(), { defaultVariant: 'rich', tableBorders: false, codeColors: false })
  const sent = decodeStdin(s.powershellRuns()[0]!.stdin)
  expect(sent.payload).toBe(cfHtml(colorCode(styleHtml(HTML_OUT.replace(/\n+$/, ''), { tableBorders: false }), false)))
  expect(s.toasts.length).toBe(1)
})

test('with nothing highlighted the last reply is copied', async () => {
  fresh()
  const s = fakeSession()
  const outcome = await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Copied the last reply with formatting'])
  expect(outcome.what).toBe('the last reply')
  expect(decodeStdin(s.powershellRuns()[0]!.stdin).text).toBe(SPAN_TEXT)
})

test('a whitespace-only highlight counts as none', async () => {
  fresh()
  const s = fakeSession({ selection: { text: '  \n ' } })
  await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Copied the last reply with formatting'])
})

test('outside full-screen mode the toast says highlights need it', async () => {
  fresh()
  const s = fakeSession()
  await runCopy(s.$, req({ fullscreen: false }), settings)
  expect(s.toasts).toEqual(['Copied the last reply with formatting (highlights need full-screen mode)'])
})

test('an explicit N copies that reply and ignores the highlight', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN } })
  await runCopy(s.$, req({ n: 2, command: '/rcopy 2' }), settings)
  expect(s.toasts).toEqual(['Copied the 2nd-last reply with formatting'])
  expect(decodeStdin(s.powershellRuns()[0]!.stdin).text).toBe('Second reply about the orchard trees.')
  expect(s.pandocRuns()[0]!.stdin).toBe(OLDER)
})

test('md of a whole reply is its markdown verbatim and runs no pandoc', async () => {
  fresh()
  const s = fakeSession()
  await runCopy(s.$, req({ variant: 'md' }), settings)
  expect(s.toasts).toEqual(['Copied the last reply as Markdown'])
  expect(s.copies).toEqual([LATEST])
  expect(s.runs).toEqual([])
})

test('md of a highlight goes through pandoc gfm', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN } })
  await runCopy(s.$, req({ variant: 'md' }), settings)
  expect(s.toasts).toEqual(['Copied a paragraph and a list as Markdown'])
  expect(s.copies).toEqual([GFM_OUT.replace(/\n+$/, '')])
  expect(s.pandocRuns().map((r) => r.argv[4])).toEqual(['json', 'gfm+hard_line_breaks'])
  expect(s.powershellRuns()).toEqual([])
})

test('plain copies clean text of the highlight', async () => {
  fresh()
  const s = fakeSession({ selection: { text: 'bold and a list' } })
  await runCopy(s.$, req({ variant: 'plain' }), settings)
  expect(s.toasts).toEqual(['Copied 4 words as plain text'])
  expect(s.copies).toEqual(['bold and a list'])
  expect(s.pandocRuns().length).toBe(1)
})

test('html copies the styled HTML source as text', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN } })
  await runCopy(s.$, req({ variant: 'html' }), settings)
  expect(s.toasts).toEqual(['Copied a paragraph and a list as HTML source'])
  expect(s.copies).toEqual([STYLED])
  expect(s.powershellRuns()).toEqual([])
})

test('a highlight in tool output falls back to its text', async () => {
  fresh()
  const text = '  ⎿  Read 3 lines\n     port: 8080'
  const s = fakeSession({ selection: { text, requestId: 'toolu_01Example' } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(["Copied as plain text: formatting only applies to Claude's replies"])
  expect(outcome.reason).toBe('tool-output')
  expect(s.copies).toEqual([text])
  expect(s.runs).toEqual([])
})

test('a highlight in no reply falls back, and says to wait while Claude is busy', async () => {
  fresh()
  const text = 'The ferry leaves the harbor at noon on weekdays'
  const idle = fakeSession({ selection: { text } })
  await runCopy(idle.$, req(), settings)
  expect(idle.toasts).toEqual(["Copied as plain text: that highlight isn't in a reply I can read"])
  expect(idle.copies).toEqual([text])

  fresh()
  const busy = fakeSession({ selection: { text } })
  await runCopy(busy.$, req({ busy: true }), settings)
  expect(busy.toasts).toEqual(["Copied as plain text: that highlight isn't in a reply I can read. Try again when Claude finishes"])
  expect(busy.copies).toEqual([text])
})

test('pandoc missing, failing or timing out falls back to the highlight', async () => {
  const cases = [
    { json: new Error('spawn pandoc ENOENT'), toast: "Copied as plain text: pandoc isn't installed (sudo apt install pandoc)", reason: 'pandoc-missing' },
    { json: failed('pandoc: parse error'), toast: 'Copied as plain text: pandoc failed. Run /rcopy doctor', reason: 'pandoc-failed' },
    { json: new Error('process timed out after 5000 ms'), toast: 'Copied as plain text: pandoc took over 5 seconds. Try again', reason: 'pandoc-timeout' },
  ]
  for (const c of cases) {
    fresh()
    const s = fakeSession({ selection: { text: SPAN }, json: c.json })
    const outcome = await runCopy(s.$, req(), settings)
    expect(s.toasts).toEqual([c.toast])
    expect(outcome.reason).toBe(c.reason)
    expect(s.copies).toEqual([SPAN])
  }
})

test('pandoc missing on a whole reply falls back to its markdown', async () => {
  fresh()
  const s = fakeSession({ json: new Error('spawn pandoc ENOENT') })
  await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(["Copied as Markdown: pandoc isn't installed (sudo apt install pandoc)"])
  expect(s.copies).toEqual([LATEST])
})

test('pandoc timing out or failing on a whole reply also says Markdown', async () => {
  const cases = [
    { json: failed('pandoc: parse error'), toast: 'Copied as Markdown: pandoc failed. Run /rcopy doctor' },
    { json: new Error('process timed out after 5000 ms'), toast: 'Copied as Markdown: pandoc took over 5 seconds. Try again' },
  ]
  for (const c of cases) {
    fresh()
    const s = fakeSession({ json: c.json })
    await runCopy(s.$, req(), settings)
    expect(s.toasts).toEqual([c.toast])
    expect(s.copies).toEqual([LATEST])
  }
})

test('pandoc failing on HTML after the cut falls back to clean text', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN }, html: failed('pandoc: writer error') })
  await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Copied as plain text: pandoc failed. Run /rcopy doctor'])
  expect(s.copies).toEqual([SPAN_TEXT])
})

test('PowerShell missing or failing falls back to clean text through ui.copy', async () => {
  const cases = [
    { powershell: new Error('spawn powershell.exe ENOENT'), toast: "Copied as plain text: Windows PowerShell wasn't found. Run /rcopy doctor" },
    { powershell: failed('Requested Clipboard operation did not succeed.'), toast: 'Copied as plain text: the Windows clipboard refused the formatted copy. Try again' },
    { powershell: new Error('process timed out after 5000 ms'), toast: 'Copied as plain text: PowerShell took over 5 seconds. Try again' },
  ]
  for (const c of cases) {
    fresh()
    const s = fakeSession({ selection: { text: SPAN }, powershell: c.powershell })
    const outcome = await runCopy(s.$, req(), settings)
    expect(s.toasts).toEqual([c.toast])
    expect(outcome.kind).toBe('fallback')
    expect(s.copies).toEqual([SPAN_TEXT])
  }
})

test('ui.copy refused and PowerShell failing leaves nothing copied', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN }, powershell: failed('Clipboard busy'), copied: false })
  const outcome = await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Nothing copied: the clipboard write failed. Run /rcopy doctor'])
  expect(outcome.kind).toBe('nothing')
  expect(outcome.reason).toBe('clipboard-failed')
  expect(s.powershellRuns().length).toBe(2)
})

test('no replies, or N past the end, copies nothing', async () => {
  fresh()
  const empty = fakeSession({ replies: [] })
  await runCopy(empty.$, req(), settings)
  expect(empty.toasts).toEqual(['Nothing copied: no Claude reply yet'])
  expect(empty.copies).toEqual([])
  expect(empty.runs).toEqual([])

  fresh()
  const short = fakeSession()
  await runCopy(short.$, req({ n: 3 }), settings)
  expect(short.toasts).toEqual(['Nothing copied: there is no 3rd-last reply'])
  expect(short.runs).toEqual([])
})

test('the run record lands under XDG_STATE_HOME with the match, summary and every lap', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN }, env: { XDG_STATE_HOME: '/state' } })
  await runCopy(s.$, req({ command: '/rcopy' }), settings)
  expect(Object.keys(s.writes)).toEqual(['/state/claude-copy/last-run.json'])
  const text = s.writes['/state/claude-copy/last-run.json']!
  expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2))
  const record = JSON.parse(text) as RunRecord
  expect(record.version).toBe('0.1.0')
  expect(record.command).toBe('/rcopy')
  expect(record.variant).toBe('rich')
  expect(record.highlight).toBe(SPAN)
  expect(record.requestId).toBe(null)
  expect(record.reply).toEqual({ index: 1, chars: LATEST.length })
  expect(record.match).not.toBe(null)
  expect(record.match!.trimmed).toBe('none')
  expect(record.summary).toBe('a paragraph and a list')
  expect(record.htmlBytes).toBe(new TextEncoder().encode(STYLED).length)
  expect(record.textChars).toBe(SPAN_TEXT.length)
  expect(record.outcome).toBe('formatted')
  expect(record.reason).toBe(null)
  expect(record.detail).toBe(null)
  expect(typeof record.at).toBe('string')
  for (const lap of ['selection', 'messages', 'find', 'cut', 'convert', 'clipboard', 'total']) {
    expect(typeof record.timings[lap]).toBe('number')
  }
  expect(s.toasts.length).toBe(1)
})

test('without XDG_STATE_HOME the record goes under HOME and keeps the failure detail', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN }, json: failed('pandoc: parse error') })
  await runCopy(s.$, req(), settings)
  const record = JSON.parse(s.writes['/home/tester/.local/state/claude-copy/last-run.json']!) as RunRecord
  expect(record.outcome).toBe('fallback')
  expect(record.reason).toBe('pandoc-failed')
  expect(record.detail).toBe('pandoc: parse error')
  expect(record.match).toBe(null)
  expect(record.summary).toBe(null)
  expect(record.htmlBytes).toBe(null)
  expect(record.textChars).toBe(SPAN.length)
  expect(s.toasts.length).toBe(1)
})

test('a stub that throws ends as a fallback toast, or nothing when no text is at hand', async () => {
  fresh()
  const s = fakeSession({ selection: { text: SPAN }, messagesThrow: 'transcript unavailable' })
  const outcome = await runCopy(s.$, req(), settings)
  expect(s.toasts).toEqual(['Copied as plain text: something went wrong (transcript unavailable)'])
  expect(outcome.reason).toBe('error')
  expect(s.copies).toEqual([SPAN])

  fresh()
  const bare = fakeSession({ messagesThrow: 'transcript unavailable' })
  const none = await runCopy(bare.$, req(), settings)
  expect(bare.toasts).toEqual(['Nothing copied: transcript unavailable'])
  expect(none.kind).toBe('nothing')
  expect(bare.copies).toEqual([])
})

test('a reply split around a tool call copies as one reply', async () => {
  fresh()
  const s = fakeSession({
    messages: [
      prompt('Invented question'),
      said('Here is **bold** and a list:'),
      { role: 'assistant', text: '', toolUses: [] },
      said('- one\n- two\n'),
    ],
  })
  await runCopy(s.$, req({ variant: 'md' }), settings)
  expect(s.copies).toEqual(['Here is **bold** and a list:\n\n- one\n- two\n'])
  expect(s.toasts.length).toBe(1)
})

const EXPECTED: Record<string, string> = {
  'whole paragraph': 'Tomatoes go along the south fence where they get the most sun, and the herbs sit in pots near the kitchen door.',
  'part of a sentence inside bold': 'must pass the smoke',
  list: '- Water bottle and a filter\n- Trail map of the north ridge\n- A light rain jacket',
  'renumbered list': '1. Unplug the power cord\n2. Wait thirty seconds\n3. Plug it back in and watch the lights',
  'heading through next paragraph': 'Choosing a tent\n\nA three-season tent covers most trips. Look for a full rain fly and at least two doors.',
  'code block': 'sort -n counts.txt | tail -5\necho done',
  'code block with language label': 'def greet(name):\n    message = f"Hello, {name}!"\n    return message.upper()',
  table:
    'Here is how the two plans compare.\n\nPlan\tNotes\nBasic starter\tIncludes one shared workspace and email support on weekdays\nPlus\tAdds unlimited workspaces and phone support\n\nThe Plus plan costs twice as much but saves time for larger teams.',
  'block quote': 'Please keep the old endpoint for one more release so mobile clients can update.',
  link: 'See the setup guide (https://example.com/docs/setup) for the full list of options.',
  'starts on the reply marker':
    'Your laptop battery report shows 312 charge cycles. That is normal wear for a two-year-old machine, and capacity is still at 91 percent.',
}

test('every match case copies the expected plain passage, and tool output falls back', async () => {
  for (const c of CASES) {
    fresh()
    const selection = c.shouldMatch ? { text: c.highlight } : { text: c.highlight, requestId: 'toolu_01Example' }
    const s = fakeSession({ replies: [c.markdown], selection })
    const outcome = await runCopy(s.$, req({ variant: 'plain' }), settings)
    expect(s.toasts.length).toBe(1)
    if (c.shouldMatch) {
      expect({ name: c.name, kind: outcome.kind, copied: s.copies }).toEqual({ name: c.name, kind: 'text', copied: [EXPECTED[c.name]!] })
    } else {
      expect({ name: c.name, kind: outcome.kind, reason: outcome.reason, copied: s.copies }).toEqual({
        name: c.name,
        kind: 'fallback',
        reason: 'tool-output',
        copied: [c.highlight],
      })
    }
  }
  expect(Object.keys(EXPECTED).length).toBe(CASES.filter((c) => c.shouldMatch).length)
})

const GRID =
  '┌─────────┬───────────────────────────────┐\n│  Plan   │             Notes             │\n├─────────┼───────────────────────────────┤\n│ Basic   │ Includes one shared workspace │\n│ starter │ and email support on weekdays │\n├─────────┼───────────────────────────────┤\n│ Plus    │ Adds unlimited workspaces and │\n│         │ phone support                 │\n└─────────┴───────────────────────────────┘'

test('an exact match in an older reply beats a near match in a newer one', async () => {
  fresh()
  const highlight =
    'Hi team,\n\nThe offsite moves to May 14 at the lake lodge. Buses leave at 8am from the main office.\n\nPlease reply by Friday so we can book enough seats.\n\nThanks, Sam'
  const s = fakeSession({ replies: [V1_MD, V2_MD], selection: { text: highlight } })
  const outcome = await runCopy(s.$, req({ variant: 'plain' }), settings)
  expect(outcome.kind).toBe('text')
  expect(s.copies).toEqual([highlight])
})

test('an older reply keeps its greeting and sign-off when the newer one changed them', async () => {
  fresh()
  const highlight =
    'Hi team,\n\nThe offsite moves to May 14 at the lake lodge. Buses leave at 8am from the main office.\n\nThanks, Sam'
  const s = fakeSession({ replies: [D1_MD, D2_MD], selection: { text: highlight } })
  await runCopy(s.$, req({ variant: 'plain' }), settings)
  expect(s.copies.length).toBe(1)
  expect(s.copies[0]).toContain('Hi team,')
  expect(s.copies[0]).toContain('Thanks, Sam')
})

test('a highlighted box-drawn table copies as a formatted table and each tree is fetched once', async () => {
  fresh()
  const s = fakeSession({ replies: [PLANS_MD], selection: { text: GRID } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  expect(s.pandocRuns().map((r) => r.argv[4])).toEqual(['json', 'html'])
})

test('a highlight that matches only after a trimmed retry still copies, and a miss copies the original text', async () => {
  fresh()
  const extra = 'Gardening notes for June\nPlant the tomatoes along the south fence.'
  const s = fakeSession({ replies: [GARDEN_MD], selection: { text: extra } })
  const outcome = await runCopy(s.$, req({ variant: 'plain' }), settings)
  expect(outcome.kind).toBe('text')
  expect(s.copies).toEqual(['Plant the tomatoes along the south fence.'])
  fresh()
  const miss = 'Nothing like this appears anywhere in the reply at all.'
  const t = fakeSession({ replies: [GARDEN_MD], selection: { text: miss } })
  const fell = await runCopy(t.$, req({ variant: 'plain' }), settings)
  expect(fell.reason).toBe('no-match')
  expect(t.copies).toEqual([miss])
})

const DRAFT_MD = 'Here is the draft:\n\n**When:** Tuesday at 10am\n**Where:** Room 4B\n**Bring:** a laptop\n\nThanks,\nAlex\n'
const DRAFT_DOC = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Here"},{"t":"Space"},{"t":"Str","c":"is"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"draft"},{"t":"Str","c":":"}]},{"t":"Para","c":[{"t":"Strong","c":[{"t":"Str","c":"When"},{"t":"Str","c":":"}]},{"t":"Space"},{"t":"Str","c":"Tuesday"},{"t":"Space"},{"t":"Str","c":"at"},{"t":"Space"},{"t":"Str","c":"10am"},{"t":"LineBreak"},{"t":"Strong","c":[{"t":"Str","c":"Where"},{"t":"Str","c":":"}]},{"t":"Space"},{"t":"Str","c":"Room"},{"t":"Space"},{"t":"Str","c":"4B"},{"t":"LineBreak"},{"t":"Strong","c":[{"t":"Str","c":"Bring"},{"t":"Str","c":":"}]},{"t":"Space"},{"t":"Str","c":"a"},{"t":"Space"},{"t":"Str","c":"laptop"}]},{"t":"Para","c":[{"t":"Str","c":"Thanks,"},{"t":"LineBreak"},{"t":"Str","c":"Alex"}]}],"meta":{}}
TREES[DRAFT_MD] = { ...DRAFT_DOC, 'pandoc-api-version': [1, 20] }

test('stacked label lines and a sign-off keep every line break', async () => {
  fresh()
  const highlight = 'When: Tuesday at 10am\nWhere: Room 4B\nBring: a laptop\n\nThanks,\nAlex'
  const s = fakeSession({ replies: [DRAFT_MD], selection: { text: highlight } })
  const outcome = await runCopy(s.$, req(), settings)
  expect(outcome.kind).toBe('formatted')
  const sent = decodeStdin(s.powershellRuns()[0]!.stdin)
  expect(sent.text).toBe('When: Tuesday at 10am\nWhere: Room 4B\nBring: a laptop\n\nThanks,\nAlex')
  const htmlRun = s.pandocRuns().find((r) => r.argv.join(' ').includes('-t html'))!
  expect(htmlRun.stdin).toContain('"LineBreak"')
  expect(htmlRun.stdin).not.toContain('"SoftBreak"')
})

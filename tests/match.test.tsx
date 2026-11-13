import { expect, test } from 'claude-code/testing'

import type { PandocDoc, Path, Trimmed } from '../types'
import { matchHighlight, mightContain, reduce, stripListMarkers, visible } from '../hooks/match'
import { cutTree } from '../hooks/cut'
import { toPlain } from '../hooks/plain'
import { CASES, DOCS } from './fixtures/match'

function leafAt(doc: PandocDoc, path: Path): string {
  let cur: any = doc.blocks
  for (const step of path) cur = step === 'c' ? cur.c : cur[step]
  return cur.t === 'Str' ? cur.c : cur.c[1]
}

const SHELL = 'find . -name "*.txt" > files.txt\nsort -n counts.txt | tail -5\necho done\n'
const PYTHON = 'def greet(name):\n    message = f"Hello, {name}!"\n    return message.upper()\n'

type Edge = { leaf: string; offset: number; char: string }
type Expected = { start: Edge; end: Edge; trimmed: Trimmed; markersStripped: boolean } | null

const edge = (leaf: string, offset: number, char: string): Edge => ({ leaf, offset, char })

const EXPECTED: Record<string, Expected> = {
  'whole paragraph': { start: edge('Tomatoes', 0, 'T'), end: edge('door.', 4, '.'), trimmed: 'none', markersStripped: false },
  'part of a sentence inside bold': { start: edge('must', 0, 'm'), end: edge('smoke', 4, 'e'), trimmed: 'none', markersStripped: false },
  list: { start: edge('Water', 0, 'W'), end: edge('jacket', 5, 't'), trimmed: 'none', markersStripped: false },
  'renumbered list': { start: edge('Unplug', 0, 'U'), end: edge('lights', 5, 's'), trimmed: 'none', markersStripped: true },
  'heading through next paragraph': { start: edge('Choosing', 0, 'C'), end: edge('doors.', 5, '.'), trimmed: 'none', markersStripped: false },
  'code block': { start: edge(SHELL, 33, 's'), end: edge(SHELL, 70, 'e'), trimmed: 'none', markersStripped: false },
  'code block with language label': { start: edge(PYTHON, 0, 'd'), end: edge(PYTHON, 74, ')'), trimmed: 'first', markersStripped: false },
  table: { start: edge('Here', 0, 'H'), end: edge('teams.', 5, '.'), trimmed: 'none', markersStripped: false },
  'block quote': { start: edge('Please', 0, 'P'), end: edge('update.', 6, '.'), trimmed: 'none', markersStripped: false },
  link: { start: edge('See', 0, 'S'), end: edge('options.', 7, '.'), trimmed: 'none', markersStripped: false },
  'starts on the reply marker': { start: edge('Your', 0, 'Y'), end: edge('percent.', 7, '.'), trimmed: 'none', markersStripped: false },
  'tool output': null,
}

test('every fixture case has an expectation', () => {
  expect(CASES.map((c) => c.name).sort()).toEqual(Object.keys(EXPECTED).sort())
})

for (const c of CASES) {
  test(`matchHighlight: ${c.name}`, () => {
    const want = EXPECTED[c.name]
    const m = matchHighlight(c.doc, c.highlight)
    if (!want) {
      expect(c.shouldMatch).toBe(false)
      expect(m).toBeNull()
      return
    }
    expect(c.shouldMatch).toBe(true)
    if (!m) throw new Error(`no match for ${c.name}`)
    const startLeaf = leafAt(c.doc, m.start.path)
    const endLeaf = leafAt(c.doc, m.end.path)
    expect(startLeaf).toBe(want.start.leaf)
    expect(m.start.offset).toBe(want.start.offset)
    expect(startLeaf[m.start.offset]).toBe(want.start.char)
    expect(endLeaf).toBe(want.end.leaf)
    expect(m.end.offset).toBe(want.end.offset)
    expect(endLeaf[m.end.offset]).toBe(want.end.char)
    expect(m.trimmed).toBe(want.trimmed)
    expect(m.markersStripped).toBe(want.markersStripped)
    expect(m.ratio).toBeGreaterThanOrEqual(0.5)
    expect(m.ratio).toBeLessThanOrEqual(1.25)
  })
}

for (const [i, c] of CASES.entries()) {
  test(`mightContain: ${c.name}`, () => {
    const other = CASES[(i + 1) % CASES.length]
    if (!other) throw new Error('no other case')
    expect(mightContain(c.markdown, c.highlight)).toBe(c.shouldMatch)
    expect(mightContain(other.markdown, c.highlight)).toBe(false)
  })
}

test('mightContain: tiny highlights and unrelated text', () => {
  expect(mightContain('Some reply text', 'a')).toBe(false)
  expect(mightContain('The kettle is on', 'kettle')).toBe(true)
  expect(mightContain('The kettle is on', 'toaster oven settings for bread')).toBe(false)
})

test('reduce keeps lowercased letters and numbers only', () => {
  expect(reduce('Héllo, Wörld! 42 ⏺ │ ┌─┐ • ▎')).toBe('héllowörld42')
  expect(reduce('**bold** `code` [link](https://example.com)')).toBe('boldcodelinkhttpsexamplecom')
  expect(reduce('')).toBe('')
})

test('visible maps each reduced character to its leaf and UTF-16 offset', () => {
  const doc: PandocDoc = {
    'pandoc-api-version': [1, 20],
    meta: {},
    blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'a😀B' }, { t: 'Space' }, { t: 'Code', c: [['', [], []], 'x.y'] }] }],
  }
  const v = visible(doc)
  expect(v.reduced).toBe('abxy')
  expect(v.spots).toHaveLength(4)
  expect(v.spots[0]).toEqual({ path: [0, 'c', 0], offset: 0 })
  expect(v.spots[1]).toEqual({ path: [0, 'c', 0], offset: 3 })
  expect(v.spots[2]).toEqual({ path: [0, 'c', 2], offset: 0 })
  expect(v.spots[3]).toEqual({ path: [0, 'c', 2], offset: 2 })
})

test('visible skips link targets, attributes and list numbers', () => {
  const link = CASES.find((c) => c.name === 'link')
  const list = CASES.find((c) => c.name === 'renumbered list')
  const code = CASES.find((c) => c.name === 'code block with language label')
  if (!link || !list || !code) throw new Error('missing case')
  expect(visible(link.doc).reduced).toBe('seethesetupguideforthefulllistofoptions')
  expect(visible(list.doc).reduced).toBe('stepstoresettherouterunplugthepowercordwaitthirtysecondsplugitbackinandwatchthelights')
  expect(visible(code.doc).reduced.includes('python')).toBe(false)
})

test('visible walks table shapes it does not know', () => {
  const cell = (word: string) => [{ t: 'Plain', c: [{ t: 'Str', c: word }] }]
  const doc: PandocDoc = {
    'pandoc-api-version': [1, 22],
    meta: {},
    blocks: [
      {
        t: 'Table',
        c: [
          ['', [], []],
          [null, []],
          [[{ t: 'AlignDefault' }, { t: 'ColWidthDefault' }]],
          [['', [], []], [[['', [], []], [[['', [], []], { t: 'AlignDefault' }, 1, 1, cell('Head')]]]]],
          [[['', [], []], 0, [], [[['', [], []], [[['', [], []], { t: 'AlignDefault' }, 1, 1, cell('Body')]]]]]],
          [['', [], []], []],
        ],
      },
    ],
  }
  const v = visible(doc)
  expect(v.reduced).toBe('headbody')
  expect(leafAt(doc, v.spots[4]?.path ?? [])).toBe('Body')
})

test('stripListMarkers removes ordered markers before the first letter or digit', () => {
  expect(stripListMarkers('1. Alpha\n2. Beta\n10) Gamma')).toBe('Alpha\nBeta\nGamma')
  expect(stripListMarkers('  iv. Four\n▎ a) Item\n⏺ B. Second')).toBe('  Four\n▎ Item\n⏺ Second')
  expect(stripListMarkers('1.5 meters\ne.g. this\nPlan 2. Next')).toBe('1.5 meters\ne.g. this\nPlan 2. Next')
  expect(stripListMarkers('• Bullet stays')).toBe('• Bullet stays')
})

test('edge punctuation is kept only when the highlight has it', () => {
  const { doc } = DOCS.quotes!
  const quoted = matchHighlight(doc, '"ship it"')
  if (!quoted) throw new Error('no match')
  expect(leafAt(doc, quoted.start.path)).toBe('"ship')
  expect(quoted.start.offset).toBe(0)
  expect(leafAt(doc, quoted.end.path)).toBe('it"')
  expect(quoted.end.offset).toBe(2)
  const bare = matchHighlight(doc, 'ship it')
  if (!bare) throw new Error('no match')
  expect(bare.start.offset).toBe(1)
  expect(bare.end.offset).toBe(1)
  const stop = matchHighlight(doc, 'it today.')
  expect(stop?.end.offset).toBe(5)
  const noStop = matchHighlight(doc, 'it today')
  expect(noStop?.end.offset).toBe(4)
})

test('a trimmed edge keeps the punctuation of the first kept line', () => {
  const c = CASES.find((x) => x.name === 'code block with language label')
  if (!c) throw new Error('missing case')
  const kept = matchHighlight(c.doc, '(name):\n    message = f"Hello, {name}!"\n    return message.upper()')
  expect(kept?.trimmed).toBe('none')
  expect(kept?.start.offset).toBe(9)
  const dropped = matchHighlight(c.doc, 'python\n(name):\n    message = f"Hello, {name}!"\n    return message.upper()')
  expect(dropped?.trimmed).toBe('first')
  expect(dropped?.start.offset).toBe(9)
})

test('falls back to the original highlight when stripping markers breaks the match', () => {
  const { doc } = DOCS.planB!
  const m = matchHighlight(doc, 'A\nB. Go')
  if (!m) throw new Error('no match')
  expect(m.markersStripped).toBe(false)
  expect(m.trimmed).toBe('none')
  expect(leafAt(doc, m.start.path)).toBe('A')
  expect(leafAt(doc, m.end.path)).toBe('Go')
  expect(m.end.offset).toBe(1)
})

test('tries the first line, then the last line, then both', () => {
  const { doc } = DOCS.spread!
  const last = matchHighlight(doc, 'Evening shift closes out the till\nInterface line at the bottom')
  expect(last?.trimmed).toBe('last')
  const both = matchHighlight(doc, 'Header row noise\nDeliveries arrive between nine and ten\nFooter row noise')
  expect(both?.trimmed).toBe('both')
  expect(matchHighlight(doc, 'xy')).toBeNull()
})

test('anchor matches must keep the span between 0.5 and 1.25 times the highlight', () => {
  const span = DOCS.spread!.doc
  const close = DOCS.close!.doc
  const skipsMiddle = 'Morning shift opens the shop and counts the register drawer. Evening shift closes out the till and locks the side door.'
  expect(matchHighlight(span, skipsMiddle)).toBeNull()
  const fits = matchHighlight(close, skipsMiddle)
  expect(fits?.ratio).toBe(1)
  const padded = 'Morning shift opens the shop and counts the register drawer. ' + 'Ran a tool that printed many lines of output here. '.repeat(3) + 'Evening shift closes out the till and locks the side door.'
  expect(matchHighlight(close, padded)).toBeNull()
  const crossesTool = 'Morning shift opens the shop and counts the register drawer. Read 3 files. Evening shift closes out the till and locks the side door.'
  const m = matchHighlight(close, crossesTool)
  if (!m) throw new Error('no match')
  expect(m.ratio).toBeLessThan(1)
  expect(m.ratio).toBeGreaterThanOrEqual(0.5)
  expect(leafAt(close, m.end.path)).toBe('door.')
})

test('mightContain ignores ordered numbers that code spans and the drawing change', () => {
  const md = '1. `api.ts`\n2. `db.ts`\n3. `ui.tsx`\n4. `README.md`\n'
  expect(mightContain(md, 'api.ts\ndb.ts\nui.tsx\nREADME.md')).toBe(true)
  expect(mightContain(md, '1. api.ts\n2. db.ts\n3. ui.tsx\n4. README.md')).toBe(true)
})

test('mightContain ignores link targets in short-link sentences', () => {
  const md =
    'Docs: [setup](https://example.com/very/long/path/setup), [usage](https://example.com/very/long/path/usage), [faq](https://example.com/very/long/path/faq), [api](https://example.com/very/long/path/api) and [blog](https://example.com/very/long/path/blog).'
  const shown = 'Docs: setup, usage, faq, api and blog.'
  let tried = 0
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j <= shown.length; j++) {
      const part = shown.slice(i, j)
      if ((part.match(/\p{L}/gu) ?? []).length < 7) continue
      tried++
      expect(mightContain(md, part)).toBe(true)
    }
  }
  expect(tried).toBeGreaterThan(10)
})

test('stripListMarkers turns task boxes after bullets into pandoc symbols', () => {
  expect(stripListMarkers('- [x] Print badges\n- [ ] Book room')).toBe('- ☒ Print badges\n- ☐ Book room')
  expect(stripListMarkers('- [X] Print badges')).toBe('- ☒ Print badges')
  expect(stripListMarkers('See [x] here')).toBe('See [x] here')
})

test('matchHighlight finds a checklist with checked first and last items', () => {
  const s = (t: string) => ({ t: 'Str', c: t })
  const item = (box: string, a: string, b: string) => [{ t: 'Plain', c: [s(box), { t: 'Space' }, s(a), { t: 'Space' }, s(b)] }]
  const doc: PandocDoc = {
    blocks: [
      {
        t: 'BulletList',
        c: [item('☒', 'Print', 'badges'), item('☐', 'Book', 'room'), item('☐', 'Order', 'snacks'), item('☒', 'Send', 'thanks')],
      },
    ],
    'pandoc-api-version': [1, 20],
    meta: {},
  }
  const m = matchHighlight(doc, '- [x] Print badges\n- [ ] Book room\n- [ ] Order snacks\n- [x] Send thanks')
  if (!m) throw new Error('no match')
  expect(m.trimmed).toBe('none')
  expect(leafAt(doc, m.start.path)).toBe('☒')
  expect(leafAt(doc, m.end.path)).toBe('thanks')
})

// pandoc 2.9.2.1 `-f gfm -t json` output for the replies below.
const TWO_VERSIONS: PandocDoc = {"blocks": [{"t": "Para", "c": [{"t": "Str", "c": "Two"}, {"t": "Space"}, {"t": "Str", "c": "versions"}, {"t": "Str", "c": ":"}]}, {"t": "Para", "c": [{"t": "Strong", "c": [{"t": "Str", "c": "Version"}, {"t": "Space"}, {"t": "Str", "c": "1"}]}]}, {"t": "Para", "c": [{"t": "Str", "c": "Hi"}, {"t": "Space"}, {"t": "Str", "c": "team,"}, {"t": "Space"}, {"t": "Str", "c": "quick"}, {"t": "Space"}, {"t": "Str", "c": "update"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "offsite."}, {"t": "Space"}, {"t": "Str", "c": "We"}, {"t": "Space"}, {"t": "Str", "c": "will"}, {"t": "Space"}, {"t": "Str", "c": "meet"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "lake"}, {"t": "Space"}, {"t": "Str", "c": "lodge"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "May"}, {"t": "Space"}, {"t": "Str", "c": "14"}, {"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}, {"t": "Str", "c": "buses"}, {"t": "Space"}, {"t": "Str", "c": "leave"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "8am."}, {"t": "Space"}, {"t": "Str", "c": "Please"}, {"t": "Space"}, {"t": "Str", "c": "reply"}, {"t": "Space"}, {"t": "Str", "c": "by"}, {"t": "Space"}, {"t": "Str", "c": "Friday"}, {"t": "Space"}, {"t": "Str", "c": "so"}, {"t": "Space"}, {"t": "Str", "c": "we"}, {"t": "Space"}, {"t": "Str", "c": "can"}, {"t": "Space"}, {"t": "Str", "c": "book"}, {"t": "Space"}, {"t": "Str", "c": "seats."}]}, {"t": "Para", "c": [{"t": "Strong", "c": [{"t": "Str", "c": "Version"}, {"t": "Space"}, {"t": "Str", "c": "2"}]}]}, {"t": "Para", "c": [{"t": "Str", "c": "Hi"}, {"t": "Space"}, {"t": "Str", "c": "team,"}, {"t": "Space"}, {"t": "Str", "c": "quick"}, {"t": "Space"}, {"t": "Str", "c": "update"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "offsite."}, {"t": "Space"}, {"t": "Str", "c": "We"}, {"t": "Space"}, {"t": "Str", "c": "will"}, {"t": "Space"}, {"t": "Str", "c": "meet"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "hill"}, {"t": "Space"}, {"t": "Str", "c": "lodge"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "May"}, {"t": "Space"}, {"t": "Str", "c": "21"}, {"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}, {"t": "Str", "c": "buses"}, {"t": "Space"}, {"t": "Str", "c": "leave"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "9am."}, {"t": "Space"}, {"t": "Str", "c": "Please"}, {"t": "Space"}, {"t": "Str", "c": "reply"}, {"t": "Space"}, {"t": "Str", "c": "by"}, {"t": "Space"}, {"t": "Str", "c": "Friday"}, {"t": "Space"}, {"t": "Str", "c": "so"}, {"t": "Space"}, {"t": "Str", "c": "we"}, {"t": "Space"}, {"t": "Str", "c": "can"}, {"t": "Space"}, {"t": "Str", "c": "book"}, {"t": "Space"}, {"t": "Str", "c": "seats."}]}], "pandoc-api-version": [1, 20], "meta": {}}
const ONE_VERSION: PandocDoc = {"blocks": [{"t": "Para", "c": [{"t": "Str", "c": "Here"}, {"t": "Space"}, {"t": "Str", "c": "is"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "note"}, {"t": "Str", "c": ":"}]}, {"t": "Para", "c": [{"t": "Str", "c": "Hi"}, {"t": "Space"}, {"t": "Str", "c": "team,"}, {"t": "Space"}, {"t": "Str", "c": "quick"}, {"t": "Space"}, {"t": "Str", "c": "update"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "offsite."}, {"t": "Space"}, {"t": "Str", "c": "We"}, {"t": "Space"}, {"t": "Str", "c": "will"}, {"t": "Space"}, {"t": "Str", "c": "meet"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "lake"}, {"t": "Space"}, {"t": "Str", "c": "lodge"}, {"t": "Space"}, {"t": "Str", "c": "on"}, {"t": "Space"}, {"t": "Str", "c": "May"}, {"t": "Space"}, {"t": "Str", "c": "14"}, {"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}, {"t": "Str", "c": "buses"}, {"t": "Space"}, {"t": "Str", "c": "leave"}, {"t": "Space"}, {"t": "Str", "c": "at"}, {"t": "Space"}, {"t": "Str", "c": "8am."}, {"t": "Space"}, {"t": "Str", "c": "Please"}, {"t": "Space"}, {"t": "Str", "c": "reply"}, {"t": "Space"}, {"t": "Str", "c": "by"}, {"t": "Space"}, {"t": "Str", "c": "Friday"}, {"t": "Space"}, {"t": "Str", "c": "so"}, {"t": "Space"}, {"t": "Str", "c": "we"}, {"t": "Space"}, {"t": "Str", "c": "can"}, {"t": "Space"}, {"t": "Str", "c": "book"}, {"t": "Space"}, {"t": "Str", "c": "seats."}]}], "pandoc-api-version": [1, 20], "meta": {}}
const GARDEN: PandocDoc = {"blocks": [{"t": "Para", "c": [{"t": "Str", "c": "The"}, {"t": "Space"}, {"t": "Str", "c": "garden"}, {"t": "Space"}, {"t": "Str", "c": "plan"}, {"t": "Space"}, {"t": "Str", "c": "has"}, {"t": "Space"}, {"t": "Str", "c": "three"}, {"t": "Space"}, {"t": "Str", "c": "parts."}]}, {"t": "Para", "c": [{"t": "Str", "c": "Plant"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "tomatoes"}, {"t": "Space"}, {"t": "Str", "c": "along"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "south"}, {"t": "Space"}, {"t": "Str", "c": "fence."}]}, {"t": "Para", "c": [{"t": "Str", "c": "Water"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "beds"}, {"t": "Space"}, {"t": "Str", "c": "early"}, {"t": "Space"}, {"t": "Str", "c": "every"}, {"t": "Space"}, {"t": "Str", "c": "morning."}]}], "pandoc-api-version": [1, 20], "meta": {}}

const LAKE = 'Hi team, quick update on the offsite. We will meet at the lake lodge on May 14 and buses leave at 8am. Please reply by Friday so we can book seats.'
const HILL = 'Hi team, quick update on the offsite. We will meet at the hill lodge on May 21 and buses leave at 9am. Please reply by Friday so we can book seats.'

test('an exact copy of the second version beats an anchor match on the first', () => {
  const m = matchHighlight(TWO_VERSIONS, HILL)
  if (!m) throw new Error('no match')
  expect(m.start.path[0]).toBe(4)
  expect(leafAt(TWO_VERSIONS, m.start.path)).toBe('Hi')
  expect(m.start.offset).toBe(0)
  expect(m.end.path[0]).toBe(4)
  expect(leafAt(TWO_VERSIONS, m.end.path)).toBe('seats.')
  expect(m.end.offset).toBe(5)
  expect(m.trimmed).toBe('none')
  expect(m.ratio).toBe(1)
  const first = matchHighlight(TWO_VERSIONS, LAKE)
  expect(first?.start.path[0]).toBe(2)
})

test('anchored matching scores the middle and picks the closest copy', () => {
  const m = matchHighlight(TWO_VERSIONS, HILL, 'anchored')
  expect(m?.start.path[0]).toBe(4)
  expect(matchHighlight(ONE_VERSION, HILL, 'anchored')).toBeNull()
  expect(matchHighlight(ONE_VERSION, HILL)).toBeNull()
  const typo = LAKE.replace('will meet', 'will meat')
  expect(matchHighlight(ONE_VERSION, typo, 'exact')).toBeNull()
  const near = matchHighlight(ONE_VERSION, typo, 'anchored')
  expect(near?.start.path[0]).toBe(1)
  expect(near?.trimmed).toBe('none')
  const threeOff = LAKE.replace('lake lodge', 'lane lodge').replace('buses leave', 'bises leove')
  expect(reduce(threeOff).length).toBeLessThan(150)
  expect(matchHighlight(ONE_VERSION, threeOff, 'anchored')).toBeNull()
})

test('the stage parameter picks which tries run', () => {
  const extra = 'Gardening notes for June\nPlant the tomatoes along the south fence.'
  expect(matchHighlight(GARDEN, extra, 'exact')).toBeNull()
  expect(matchHighlight(GARDEN, extra, 'anchored')).toBeNull()
  expect(matchHighlight(GARDEN, extra, 'trimmed')?.trimmed).toBe('first')
  expect(matchHighlight(GARDEN, extra)?.trimmed).toBe('first')
  const whole = 'Plant the tomatoes along the south fence.'
  expect(matchHighlight(GARDEN, whole, 'exact')?.trimmed).toBe('none')
  expect(matchHighlight(GARDEN, whole, 'anchored')).toBeNull()
  expect(matchHighlight(GARDEN, whole, 'trimmed')).toBeNull()
  expect(matchHighlight(GARDEN, whole, 'any')?.trimmed).toBe('none')
  expect(matchHighlight(TWO_VERSIONS, HILL, 'exact')?.start.path[0]).toBe(4)
})

test('a trimmed retry is refused when the dropped line is reply text', () => {
  const reversed = 'Water the beds early every morning.\nPlant the tomatoes along the south fence.'
  expect(matchHighlight(GARDEN, reversed)).toBeNull()
  expect(matchHighlight(GARDEN, reversed, 'trimmed')).toBeNull()
  const foreignLast = 'Plant the tomatoes along the south fence.\nSide note from the editor'
  expect(matchHighlight(GARDEN, foreignLast)?.trimmed).toBe('last')
})

// pandoc 2.9.2.1 `-f gfm+hard_line_breaks -t json` output for the replies below.
const BOLD_STEP: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Strong","c":[{"t":"Str","c":"1."},{"t":"Space"},{"t":"Str","c":"Back"},{"t":"Space"},{"t":"Str","c":"up"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"database"}]}]},{"t":"Para","c":[{"t":"Str","c":"Copy"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"data"},{"t":"Space"},{"t":"Str","c":"folder"},{"t":"Space"},{"t":"Str","c":"to"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"spare"},{"t":"Space"},{"t":"Str","c":"drive"},{"t":"Space"},{"t":"Str","c":"before"},{"t":"Space"},{"t":"Str","c":"you"},{"t":"Space"},{"t":"Str","c":"start."}]}],"pandoc-api-version":[1,20],"meta":{}}
const NUMBERED_HEADING: PandocDoc = {"blocks":[{"t":"Header","c":[2,["2-bind-the-key",[],[]],[{"t":"Str","c":"2."},{"t":"Space"},{"t":"Str","c":"Bind"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"key"}]]},{"t":"Para","c":[{"t":"Str","c":"Open"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"keybindings"},{"t":"Space"},{"t":"Str","c":"file"},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"add"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"new"},{"t":"Space"},{"t":"Str","c":"entry."}]}],"pandoc-api-version":[1,20],"meta":{}}
const INITIAL: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"A."},{"t":"Space"},{"t":"Str","c":"Smith"},{"t":"Space"},{"t":"Str","c":"wrote"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"guide."}]}],"pandoc-api-version":[1,20],"meta":{}}
const TWO_SENTENCES: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Read"},{"t":"Space"},{"t":"Str","c":"this."},{"t":"Space"},{"t":"Str","c":"See"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"guide"},{"t":"Space"},{"t":"Str","c":"for"},{"t":"Space"},{"t":"Str","c":"details."}]}],"pandoc-api-version":[1,20],"meta":{}}
const MIXED_LIST: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Strong","c":[{"t":"Str","c":"1."},{"t":"Space"},{"t":"Str","c":"Back"},{"t":"Space"},{"t":"Str","c":"up"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"database"}]}]},{"t":"Para","c":[{"t":"Str","c":"Then"},{"t":"Str","c":":"}]},{"t":"OrderedList","c":[[1,{"t":"DefaultStyle"},{"t":"Period"}],[[{"t":"Plain","c":[{"t":"Str","c":"stop"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"app"}]}],[{"t":"Plain","c":[{"t":"Str","c":"copy"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"files"}]}]]]}],"pandoc-api-version":[1,20],"meta":{}}
const STEP_ONE: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Finish"},{"t":"Space"},{"t":"Str","c":"step"},{"t":"Space"},{"t":"Str","c":"1"}]},{"t":"OrderedList","c":[[1,{"t":"DefaultStyle"},{"t":"Period"}],[[{"t":"Plain","c":[{"t":"Str","c":"stop"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"app"}]}],[{"t":"Plain","c":[{"t":"Str","c":"copy"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"files"}]}]]]}],"pandoc-api-version":[1,20],"meta":{}}
const NUMBERED_CODE: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Steps"},{"t":"Str","c":":"}]},{"t":"CodeBlock","c":[["",["text"],[]],"1. Install the tool\n2. Run it\n"]}],"pandoc-api-version":[1,20],"meta":{}}
const CODE_THEN_LIST: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Run"},{"t":"Space"},{"t":"Str","c":"this"},{"t":"Str","c":":"}]},{"t":"CodeBlock","c":[["",[],[]],"finish step 1\n"]},{"t":"OrderedList","c":[[1,{"t":"DefaultStyle"},{"t":"Period"}],[[{"t":"Plain","c":[{"t":"Str","c":"stop"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"app"}]}],[{"t":"Plain","c":[{"t":"Str","c":"copy"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"files"}]}]]]}],"pandoc-api-version":[1,20],"meta":{}}
const CODE_LINE_THEN_LIST: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Steps"},{"t":"Str","c":":"}]},{"t":"CodeBlock","c":[["",["text"],[]],"1. Install the tool\n"]},{"t":"OrderedList","c":[[1,{"t":"DefaultStyle"},{"t":"Period"}],[[{"t":"Plain","c":[{"t":"Str","c":"stop"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"app"}]}],[{"t":"Plain","c":[{"t":"Str","c":"copy"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"files"}]}]]]}],"pandoc-api-version":[1,20],"meta":{}}
const CODE_STEPS = '1. Install the tool\n2. Run it\n'

function startsAt(doc: PandocDoc, highlight: string, leaf: string, offset: number, block: number) {
  const m = matchHighlight(doc, highlight)
  if (!m) throw new Error(`no match for ${highlight}`)
  expect(leafAt(doc, m.start.path)).toBe(leaf)
  expect(m.start.offset).toBe(offset)
  expect(m.start.path[0]).toBe(block)
  return m
}

test('a bold numbered step keeps its number', () => {
  const m = startsAt(BOLD_STEP, '1. Back up the database\n\nCopy the data folder to the spare drive before you start.', '1.', 0, 0)
  expect(m.markersStripped).toBe(false)
  expect(leafAt(BOLD_STEP, m.end.path)).toBe('start.')
})

test('a numbered heading keeps its number', () => {
  const m = startsAt(NUMBERED_HEADING, '2. Bind the key\n\nOpen the keybindings file and add the new entry.', '2.', 0, 0)
  expect(m.markersStripped).toBe(false)
})

test('a leading initial is real text', () => {
  const m = startsAt(INITIAL, 'A. Smith wrote the guide.', 'A.', 0, 0)
  expect(m.markersStripped).toBe(false)
  expect(leafAt(INITIAL, m.end.path)).toBe('guide.')
})

test('a highlight that starts mid-word before a period keeps that letter', () => {
  const m = startsAt(TWO_SENTENCES, 's. See the guide for details.', 'this.', 3, 0)
  expect(m.markersStripped).toBe(false)
})

test('a stripped match widens back over a number that is visible text', () => {
  const m = startsAt(MIXED_LIST, '1. Back up the database\n\nThen:\n\n1. stop the app\n2. copy the files', '1.', 0, 0)
  expect(m.markersStripped).toBe(true)
  expect(m.trimmed).toBe('none')
  expect(leafAt(MIXED_LIST, m.end.path)).toBe('files')
})

test('a list number never pulls in the end of the paragraph before it', () => {
  for (const highlight of ['1. stop the app', '1. stop the app\n2. copy the files']) {
    const m = startsAt(STEP_ONE, highlight, 'stop', 0, 1)
    expect(m.markersStripped).toBe(true)
  }
})

test('a code block whose first line starts with a number matches from its first character', () => {
  const m = startsAt(NUMBERED_CODE, '1. Install the tool\n2. Run it', CODE_STEPS, 0, 1)
  expect(m.start.path).toEqual([1])
  expect(m.markersStripped).toBe(false)
  expect(m.trimmed).toBe('none')
  expect(leafAt(NUMBERED_CODE, m.end.path)).toBe(CODE_STEPS)
  expect(m.end.offset).toBe(28)
  expect(startsAt(NUMBERED_CODE, '2. Run it', CODE_STEPS, 20, 1).markersStripped).toBe(false)
})

test('a list number never pulls in the end of a code block before it', () => {
  for (const highlight of ['1. stop the app', '1. stop the app\n2. copy the files']) {
    const m = startsAt(CODE_THEN_LIST, highlight, 'stop', 0, 2)
    expect(m.markersStripped).toBe(true)
  }
})

test('a stripped match widens back over a number that is code text', () => {
  const m = startsAt(CODE_LINE_THEN_LIST, '1. Install the tool\n\n1. stop the app\n2. copy the files', '1. Install the tool\n', 0, 1)
  expect(m.markersStripped).toBe(true)
  expect(m.trimmed).toBe('none')
  expect(leafAt(CODE_LINE_THEN_LIST, m.end.path)).toBe('files')
})


// pandoc 2.9.2.1 `-f gfm+hard_line_breaks-emoji -t json` output for the replies below.
const EMOJI_DRAFT: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Hey"},{"t":"Space"},{"t":"Str","c":"team"},{"t":"Space"},{"t":"Str","c":":wave:"}]},{"t":"Para","c":[{"t":"Str","c":"The"},{"t":"Space"},{"t":"Str","c":"boxes"},{"t":"Space"},{"t":"Str","c":"are"},{"t":"Space"},{"t":"Str","c":"packed"},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"van"},{"t":"Space"},{"t":"Str","c":"is"},{"t":"Space"},{"t":"Str","c":"booked"},{"t":"Space"},{"t":"Str","c":"for"},{"t":"Space"},{"t":"Str","c":"Saturday"},{"t":"Space"},{"t":"Str","c":"morning."}]},{"t":"Para","c":[{"t":"Str","c":"Great"},{"t":"Space"},{"t":"Str","c":"work"},{"t":"Space"},{"t":"Str","c":"everyone"},{"t":"Space"},{"t":"Str","c":":tada:"}]}],"pandoc-api-version":[1,20],"meta":{}}
const TASK_LIST: PandocDoc = {"blocks":[{"t":"BulletList","c":[[{"t":"Plain","c":[{"t":"Str","c":"☐"},{"t":"Space"},{"t":"Str","c":"Pack"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"boxes"}]}],[{"t":"Plain","c":[{"t":"Str","c":"☒"},{"t":"Space"},{"t":"Str","c":"Call"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"landlord"},{"t":"Space"},{"t":"Str","c":"about"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"deposit"}]}],[{"t":"Plain","c":[{"t":"Str","c":"☐"},{"t":"Space"},{"t":"Str","c":"Return"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"keys"}]}]]}],"pandoc-api-version":[1,20],"meta":{}}
const TWO_PARAS: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Friday"},{"t":"Space"},{"t":"Str","c":"we"},{"t":"Space"},{"t":"Str","c":"review"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"plan"},{"t":"Space"},{"t":"Str","c":"for"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"lake"},{"t":"Space"},{"t":"Str","c":"trip"},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"budget."}]},{"t":"Para","c":[{"t":"Str","c":"Bring"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"signed"},{"t":"Space"},{"t":"Str","c":"form"},{"t":"Space"},{"t":"Str","c":"to"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"front"},{"t":"Space"},{"t":"Str","c":"desk."}]}],"pandoc-api-version":[1,20],"meta":{}}

test('stripListMarkers turns a task box with no bullet into a box character', () => {
  expect(stripListMarkers('[x] Call')).toBe('☒ Call')
  expect(stripListMarkers('[ ] Call')).toBe('☐ Call')
  expect(stripListMarkers('- [x] Call')).toBe('- ☒ Call')
  expect(stripListMarkers('[x]Call')).toBe('[x]Call')
})

test('mightContain finds a task item highlighted without its bullet', () => {
  expect(mightContain('- [ ] Pack the boxes\n- [x] Call the landlord about the deposit', '[x] Call the landlord about the deposit')).toBe(true)
})

test('a draft with emoji shortcodes on its first and last lines matches in full', () => {
  const highlight = 'Hey team :wave:\n\nThe boxes are packed and the van is booked for Saturday morning.\n\nGreat work everyone :tada:'
  const m = matchHighlight(EMOJI_DRAFT, highlight)
  if (!m) throw new Error('no match')
  expect(m.trimmed).toBe('none')
  expect(leafAt(EMOJI_DRAFT, m.start.path)).toBe('Hey')
  expect(leafAt(EMOJI_DRAFT, m.end.path)).toBe(':tada:')
})

test('a drag that starts on a task box without its bullet matches from the box', () => {
  const m = matchHighlight(TASK_LIST, '[x] Call the landlord about the deposit\n- [ ] Return the keys')
  if (!m) throw new Error('no match')
  expect(m.trimmed).toBe('none')
  expect(leafAt(TASK_LIST, m.start.path)).toBe('☒')
  expect(leafAt(TASK_LIST, m.end.path)).toBe('keys')
  const plain = toPlain(cutTree(TASK_LIST, m.start, m.end).blocks)
  expect(plain).toBe('- ☑ Call the landlord about the deposit\n- ☐ Return the keys')
})

test('a first line one word off a real line blocks the trim', () => {
  const near = 'Monday we review the plan for the lake trip and the budget.\nBring the signed form to the front desk.'
  expect(matchHighlight(TWO_PARAS, near)).toBeNull()
  const real = 'Friday we review the plan for the lake trip and the budget.\nBring the signed form to the front desk.'
  expect(matchHighlight(TWO_PARAS, real)?.trimmed).toBe('none')
})

test('a last line one word off a real line blocks the trim', () => {
  const near = 'Friday we review the plan for the lake trip and the budget.\nBring the signed form to the back desk.'
  expect(matchHighlight(TWO_PARAS, near)).toBeNull()
})

test('a real line followed by a quoted question from outside the reply still trims the last line', () => {
  const m = matchHighlight(TWO_PARAS, 'Bring the signed form to the front desk.\n> Invented question 2')
  expect(m?.trimmed).toBe('last')
})

const PAREN_ENDING: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"Lunch"},{"t":"Space"},{"t":"Str","c":"is"},{"t":"Space"},{"t":"Str","c":"at"},{"t":"Space"},{"t":"Str","c":"noon"},{"t":"Space"},{"t":"Str","c":"on"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"patio."}]},{"t":"Para","c":[{"t":"Str","c":"Please"},{"t":"Space"},{"t":"Str","c":"reply"},{"t":"Space"},{"t":"Str","c":"by"},{"t":"Space"},{"t":"Str","c":"Friday"},{"t":"Space"},{"t":"Str","c":"(so"},{"t":"Space"},{"t":"Str","c":"we"},{"t":"Space"},{"t":"Str","c":"can"},{"t":"Space"},{"t":"Str","c":"book"},{"t":"Space"},{"t":"Str","c":"seats)."}]}],"pandoc-api-version":[1,20],"meta":{}}
const QUOTED_OPENER: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"\"Quoted"},{"t":"Space"},{"t":"Str","c":"opener\""},{"t":"Space"},{"t":"Str","c":"starts"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"paragraph"},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"runs"},{"t":"Space"},{"t":"Str","c":"on."}]}],"pandoc-api-version":[1,20],"meta":{}}

function lastStr(doc: PandocDoc): string {
  const strs: string[] = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') {
      const node = value as { t?: string; c?: unknown }
      if (node.t === 'Str' && typeof node.c === 'string') strs.push(node.c)
      else if ('c' in node) walk(node.c)
    }
  }
  walk(doc.blocks)
  return strs[strs.length - 1] ?? ''
}

function firstStr(doc: PandocDoc): string {
  const walk = (value: unknown): string | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item)
        if (found !== null) return found
      }
      return null
    }
    if (value && typeof value === 'object') {
      const node = value as { t?: string; c?: unknown }
      if (node.t === 'Str' && typeof node.c === 'string') return node.c
      if ('c' in node) return walk(node.c)
    }
    return null
  }
  return walk(doc.blocks) ?? ''
}

test('a dropped last line keeps the closing punctuation of the kept text', () => {
  const m = matchHighlight(PAREN_ENDING, 'Please reply by Friday (so we can book seats).\n> Invented question 2')
  if (!m) throw new Error('no match')
  expect(m.trimmed).toBe('last')
  const cut = cutTree(PAREN_ENDING, m.start, m.end)
  expect(toPlain(cut.blocks)).toBe('Please reply by Friday (so we can book seats).')
  expect(lastStr(cut)).toBe('seats).')
})

test('a dropped first line keeps the opening quote of the kept text', () => {
  const m = matchHighlight(QUOTED_OPENER, '> Invented question 1\n"Quoted opener" starts the paragraph and runs on.')
  if (!m) throw new Error('no match')
  expect(m.trimmed).toBe('first')
  const cut = cutTree(QUOTED_OPENER, m.start, m.end)
  expect(toPlain(cut.blocks).startsWith('"Quoted')).toBe(true)
  expect(firstStr(cut)).toBe('"Quoted')
})

const NEXT_STEPS: PandocDoc = {"blocks":[{"t":"Header","c":[2,["next-steps",[],[]],[{"t":"Str","c":"Next"},{"t":"Space"},{"t":"Str","c":"steps"}]]},{"t":"Para","c":[{"t":"Str","c":"We"},{"t":"Space"},{"t":"Str","c":"agreed"},{"t":"Space"},{"t":"Str","c":"on"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"plan."},{"t":"Space"},{"t":"Str","c":"The"},{"t":"Space"},{"t":"Str","c":"next"},{"t":"Space"},{"t":"Str","c":"steps"},{"t":"Space"},{"t":"Str","c":"are"},{"t":"Space"},{"t":"Str","c":"to"},{"t":"Space"},{"t":"Str","c":"book"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Str","c":"venue"},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"send"},{"t":"Space"},{"t":"Str","c":"invites."}]}],"pandoc-api-version":[1,20],"meta":{}}

function cutOf(doc: PandocDoc, highlight: string) {
  const m = matchHighlight(doc, highlight)
  if (!m) throw new Error('no match')
  return cutTree(doc, m.start, m.end)
}

test('a lower-case highlight copies the paragraph words, not the same-spelled heading', () => {
  const cut = cutOf(NEXT_STEPS, 'next steps')
  expect(cut.blocks[0]?.t).toBe('Para')
  expect(toPlain(cut.blocks)).toBe('next steps')
})

test('a capitalized highlight copies the heading', () => {
  const cut = cutOf(NEXT_STEPS, 'Next steps')
  expect(cut.blocks[0]?.t).toBe('Header')
  expect(toPlain(cut.blocks)).toBe('Next steps')
})

test('a highlight with no case-equal occurrence still takes the first one', () => {
  const cut = cutOf(NEXT_STEPS, 'NEXT STEPS')
  expect(cut.blocks[0]?.t).toBe('Header')
})

test('visible is built once per tree', () => {
  expect(visible(NEXT_STEPS)).toBe(visible(NEXT_STEPS))
})

test('the cased twin has the length of the reduced text with İ and ẞ', () => {
  const doc: PandocDoc = {"blocks":[{"t":"Para","c":[{"t":"Str","c":"İstanbul"},{"t":"Space"},{"t":"Str","c":"STRAẞE"},{"t":"Space"},{"t":"Str","c":"ǅ"}]}],"pandoc-api-version":[1,20],"meta":{}}
  const v = visible(doc)
  expect(v.cased.length).toBe(v.reduced.length)
  expect(v.cased.length).toBe(v.spots.length)
  expect(v.reduced).toBe('istanbulstraßeǆ')
  expect(v.cased).toBe('istanbulSTRAẞEǅ')
})

test('stripListMarkers finds task boxes after the reply marker, a quote bar or no bullet', () => {
  expect(stripListMarkers('⏺ • [x] Pack\n▎ • [ ] Book the bus\n[x] Call\n⏺ [ ] Wait')).toBe('⏺ • ☒ Pack\n▎ • ☐ Book the bus\n☒ Call\n⏺ ☐ Wait')
})

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for each markdown below.
const BR_MD = "Wash the jars<br>Dry them fully before you fill them.\n"
const BR_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Wash\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"jars\"},{\"t\":\"RawInline\",\"c\":[\"html\",\"<br>\"]},{\"t\":\"Str\",\"c\":\"Dry\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"them\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"fully\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"before\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"you\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"fill\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"them.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
const CODE_PROMPT_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"At\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"prompt,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"type\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"these\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"two\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lines:\"}]},{\"t\":\"CodeBlock\",\"c\":[[\"\",[],[]],\"> run the build\\n> run the tests\\n\"]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

test('an inline br matches whether Claude Code draws it as a line break or as text', () => {
  for (const highlight of ['Wash the jars<br>Dry them fully', 'Wash the jars\nDry them fully', 'Wash the jars<br/>Dry them fully']) {
    const m = matchHighlight(BR_DOC, highlight)
    expect(m?.trimmed).toBe('none')
    expect(toPlain(cutTree(BR_DOC, m!.start, m!.end).blocks)).toBe('Wash the jars\nDry them fully')
    expect(mightContain(BR_MD, highlight)).toBe(true)
  }
})

test("a '> ' line that is in the reply is not taken for the person's prompt", () => {
  const m = matchHighlight(CODE_PROMPT_DOC, '> run the build\n> run the tests\n> Invented question 2')
  expect(m?.trimmed).toBe('last')
  expect(toPlain(cutTree(CODE_PROMPT_DOC, m!.start, m!.end).blocks)).toBe('> run the build\n> run the tests')
})

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for CODE_BR_MD.
const CODE_BR_MD = "Use `<br>` inside a table cell for a line break.\n"
const CODE_BR_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Use\"},{\"t\":\"Space\"},{\"t\":\"Code\",\"c\":[[\"\",[],[]],\"<br>\"]},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"inside\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"a\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"table\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"cell\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"a\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"line\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"break.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")

test('a br inside inline code stays text in the match', () => {
  const highlight = 'Use <br> inside a table cell for a line break.'
  const m = matchHighlight(CODE_BR_DOC, highlight)
  expect(m?.trimmed).toBe('none')
  expect(toPlain(cutTree(CODE_BR_DOC, m!.start, m!.end).blocks)).toBe(highlight)
  expect(mightContain(CODE_BR_MD, highlight)).toBe(true)
})

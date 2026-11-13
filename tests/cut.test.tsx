import { expect, test } from 'claude-code/testing'

import type { PNode, PandocDoc, Path, Spot } from '../types'
import { cutTree } from '../hooks/cut'
import { matchHighlight } from '../hooks/match'
import { toPlain } from '../hooks/plain'

const doc = (blocks: PNode[]): PandocDoc => ({ 'pandoc-api-version': [1, 20], meta: {}, blocks })
const str = (c: string): PNode => ({ t: 'Str', c })
const sp: PNode = { t: 'Space' }

// pandoc 2.9.2.1, -f gfm -t json, on invented markdown

// The garden needs watering before noon.
const GARDEN = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'The' }, { t: 'Space' }, { t: 'Str', c: 'garden' }, { t: 'Space' }, { t: 'Str', c: 'needs' }, { t: 'Space' }, { t: 'Str', c: 'watering' }, { t: 'Space' }, { t: 'Str', c: 'before' }, { t: 'Space' }, { t: 'Str', c: 'noon.' }] },
])

// Pack a **warm jacket and boots** for the hike.
const JACKET = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Pack' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Strong', c: [{ t: 'Str', c: 'warm' }, { t: 'Space' }, { t: 'Str', c: 'jacket' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'boots' }] }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'hike.' }] },
])

// Shopping list:\n\n- apples\n- bread rolls\n- cheese
const SHOPPING = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Shopping' }, { t: 'Space' }, { t: 'Str', c: 'list' }, { t: 'Str', c: ':' }] },
  { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'apples' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'bread' }, { t: 'Space' }, { t: 'Str', c: 'rolls' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'cheese' }] }]] },
])

// 3. Preheat the oven\n4. Mix the batter\n5. Bake for twenty minutes
const BAKING = doc([
  { t: 'OrderedList', c: [[3, { t: 'DefaultStyle' }, { t: 'Period' }], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Preheat' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'oven' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Mix' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'batter' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Bake' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'twenty' }, { t: 'Space' }, { t: 'Str', c: 'minutes' }] }]]] },
])

// # Weekly plan here\n\nStart with the easy tasks first.\n\nThen rest.
const PLAN = doc([
  { t: 'Header', c: [1, ['weekly-plan-here', [], []], [{ t: 'Str', c: 'Weekly' }, { t: 'Space' }, { t: 'Str', c: 'plan' }, { t: 'Space' }, { t: 'Str', c: 'here' }]] },
  { t: 'Para', c: [{ t: 'Str', c: 'Start' }, { t: 'Space' }, { t: 'Str', c: 'with' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'easy' }, { t: 'Space' }, { t: 'Str', c: 'tasks' }, { t: 'Space' }, { t: 'Str', c: 'first.' }] },
  { t: 'Para', c: [{ t: 'Str', c: 'Then' }, { t: 'Space' }, { t: 'Str', c: 'rest.' }] },
])

// Prices below.\n\n| Fruit | Price |\n|:------|------:|\n| Mango | 2 |\n| Kiwi | 1 |\n\nAll prices in coins.
const PRICES = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Prices' }, { t: 'Space' }, { t: 'Str', c: 'below.' }] },
  { t: 'Table', c: [[], [{ t: 'AlignLeft' }, { t: 'AlignRight' }], [0, 0], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Fruit' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Price' }] }]], [[[{ t: 'Plain', c: [{ t: 'Str', c: 'Mango' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: '2' }] }]], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Kiwi' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: '1' }] }]]]] },
  { t: 'Para', c: [{ t: 'Str', c: 'All' }, { t: 'Space' }, { t: 'Str', c: 'prices' }, { t: 'Space' }, { t: 'Str', c: 'in' }, { t: 'Space' }, { t: 'Str', c: 'coins.' }] },
])

// Run this:\n\n```python\nfirst = 1\nsecond = 2\nthird = 3\nfourth = 4\n```\n\nDone.
const CODE = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Run' }, { t: 'Space' }, { t: 'Str', c: 'this' }, { t: 'Str', c: ':' }] },
  { t: 'CodeBlock', c: [['', ['python'], []], 'first = 1\nsecond = 2\nthird = 3\nfourth = 4\n'] },
  { t: 'Para', c: [{ t: 'Str', c: 'Done.' }] },
])

// > Quoted line one\n> still quoted here\n\nAfter the quote.
const QUOTE = doc([
  { t: 'BlockQuote', c: [{ t: 'Para', c: [{ t: 'Str', c: 'Quoted' }, { t: 'Space' }, { t: 'Str', c: 'line' }, { t: 'Space' }, { t: 'Str', c: 'one' }, { t: 'SoftBreak' }, { t: 'Str', c: 'still' }, { t: 'Space' }, { t: 'Str', c: 'quoted' }, { t: 'Space' }, { t: 'Str', c: 'here' }] }] },
  { t: 'Para', c: [{ t: 'Str', c: 'After' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'quote.' }] },
])

// - outer one\n    - inner alpha\n    - inner beta\n- outer two
const NESTED = doc([
  { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'outer' }, { t: 'Space' }, { t: 'Str', c: 'one' }] }, { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'inner' }, { t: 'Space' }, { t: 'Str', c: 'alpha' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'inner' }, { t: 'Space' }, { t: 'Str', c: 'beta' }] }]] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'outer' }, { t: 'Space' }, { t: 'Str', c: 'two' }] }]] },
])

// Above the line\n\n---\n\nBelow the line
const RULE = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Above' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'line' }] },
  { t: 'HorizontalRule' },
  { t: 'Para', c: [{ t: 'Str', c: 'Below' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'line' }] },
])

// Use `npm test` and [the docs](https://example.com/docs) today.
const LINKED = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Use' }, { t: 'Space' }, { t: 'Code', c: [['', [], []], 'npm test'] }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Link', c: [['', [], []], [{ t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'docs' }], ['https://example.com/docs', '']] }, { t: 'Space' }, { t: 'Str', c: 'today.' }] },
])

// Stars 🌟 shine
const STARS = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'Stars' }, { t: 'Space' }, { t: 'Str', c: '🌟' }, { t: 'Space' }, { t: 'Str', c: 'shine' }] },
])

const LEAVES = new Set(['Str', 'Code', 'Math', 'RawInline', 'CodeBlock'])

function leaves(d: PandocDoc): { path: Path; text: string }[] {
  const out: { path: Path; text: string }[] = []
  const walk = (value: unknown, at: Path): void => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...at, i]))
    } else if (value && typeof value === 'object' && typeof (value as PNode).t === 'string') {
      const node = value as PNode
      if (LEAVES.has(node.t)) out.push({ path: at, text: node.t === 'Str' ? node.c : node.c[1] })
      walk(node.c, [...at, 'c'])
    }
  }
  walk(d.blocks, [])
  return out
}

// The spot of `needle`'s first character (plus delta) in the nth leaf whose text contains it.
function at(d: PandocDoc, needle: string, delta = 0, nth = 0): Spot {
  const hit = leaves(d).filter((leaf) => leaf.text.includes(needle))[nth]
  if (!hit) throw new Error(`no leaf holds ${needle}`)
  return { path: hit.path, offset: hit.text.indexOf(needle) + delta }
}

// The spot of `needle`'s last character in the nth leaf whose text contains it.
function upTo(d: PandocDoc, needle: string, nth = 0): Spot {
  return at(d, needle, needle.length - 1, nth)
}

test('start and end mid-word in one Str', () => {
  const out = cutTree(GARDEN, at(GARDEN, 'teri'), upTo(GARDEN, 'teri'))
  expect(out.blocks).toEqual([{ t: 'Para', c: [str('teri')] }])
  const word = cutTree(GARDEN, at(GARDEN, 'arde'), upTo(GARDEN, 'arde'))
  expect(word.blocks).toEqual([{ t: 'Para', c: [str('arde')] }])
})

test('a range across words trims the first and last leaf', () => {
  const out = cutTree(GARDEN, at(GARDEN, 'rden'), upTo(GARDEN, 'befo'))
  expect(out.blocks).toEqual([
    { t: 'Para', c: [str('rden'), sp, str('needs'), sp, str('watering'), sp, str('befo')] },
  ])
})

test('keeps the api version and meta', () => {
  const withMeta: PandocDoc = { ...GARDEN, meta: { title: { t: 'MetaString', c: 'Notes' } } }
  const out = cutTree(withMeta, at(withMeta, 'garden'), upTo(withMeta, 'needs'))
  expect(out['pandoc-api-version']).toEqual([1, 20])
  expect(out.meta).toEqual({ title: { t: 'MetaString', c: 'Notes' } })
  expect(out.meta === withMeta.meta).toBe(false)
})

test('bold cut in half keeps the Strong around what survives', () => {
  const out = cutTree(JACKET, at(JACKET, 'ck'), upTo(JACKET, 'jack'))
  expect(out.blocks).toEqual([
    { t: 'Para', c: [str('ck'), sp, str('a'), sp, { t: 'Strong', c: [str('warm'), sp, str('jack')] }] },
  ])
  const tail = cutTree(JACKET, at(JACKET, 'boots', 2), upTo(JACKET, 'for'))
  expect(tail.blocks).toEqual([
    { t: 'Para', c: [{ t: 'Strong', c: [str('ots')] }, sp, str('for')] },
  ])
})

test('bullet list from its second item drops the first item and the intro', () => {
  const out = cutTree(SHOPPING, at(SHOPPING, 'bread'), upTo(SHOPPING, 'cheese'))
  expect(out.blocks).toEqual([
    { t: 'BulletList', c: [[{ t: 'Plain', c: [str('bread'), sp, str('rolls')] }], [{ t: 'Plain', c: [str('cheese')] }]] },
  ])
})

test('ordered list from its second item raises the start number', () => {
  const out = cutTree(BAKING, at(BAKING, 'Mix'), upTo(BAKING, 'twenty'))
  expect(out.blocks).toEqual([
    {
      t: 'OrderedList',
      c: [
        [4, { t: 'DefaultStyle' }, { t: 'Period' }],
        [[{ t: 'Plain', c: [str('Mix'), sp, str('the'), sp, str('batter')] }], [{ t: 'Plain', c: [str('Bake'), sp, str('for'), sp, str('twenty')] }]],
      ],
    },
  ])
  const third = cutTree(BAKING, at(BAKING, 'Bake'), upTo(BAKING, 'minutes'))
  expect(third.blocks[0]!.c[0][0]).toBe(5)
})

test('heading through the next paragraph keeps the level and id', () => {
  const out = cutTree(PLAN, at(PLAN, 'here'), upTo(PLAN, 'easy'))
  expect(out.blocks).toEqual([
    { t: 'Header', c: [1, ['weekly-plan-here', [], []], [str('here')]] },
    { t: 'Para', c: [str('Start'), sp, str('with'), sp, str('the'), sp, str('easy')] },
  ])
})

test('table kept whole from mid-cell, the next paragraph trimmed', () => {
  const out = cutTree(PRICES, at(PRICES, 'ngo'), upTo(PRICES, 'prices'))
  expect(out.blocks).toEqual([PRICES.blocks[1], { t: 'Para', c: [str('All'), sp, str('prices')] }])
  const inside = cutTree(PRICES, at(PRICES, 'Kiwi', 1), upTo(PRICES, 'Kiwi'))
  expect(inside.blocks).toEqual([PRICES.blocks[1]])
})

test('table kept whole when the range ends inside it', () => {
  const out = cutTree(PRICES, at(PRICES, 'below'), upTo(PRICES, 'Fru'))
  expect(out.blocks).toEqual([{ t: 'Para', c: [str('below.')] }, PRICES.blocks[1]])
})

test('code block keeps only the touched lines', () => {
  const middle = cutTree(CODE, at(CODE, 'cond'), at(CODE, '= 3'))
  expect(middle.blocks).toEqual([{ t: 'CodeBlock', c: [['', ['python'], []], 'second = 2\nthird = 3\n'] }])
  const fromIntro = cutTree(CODE, at(CODE, 'this'), at(CODE, 'second'))
  expect(fromIntro.blocks).toEqual([
    { t: 'Para', c: [str('this'), str(':')] },
    { t: 'CodeBlock', c: [['', ['python'], []], 'first = 1\nsecond = 2\n'] },
  ])
  const intoOutro = cutTree(CODE, at(CODE, 'third'), upTo(CODE, 'Done'))
  expect(intoOutro.blocks).toEqual([
    { t: 'CodeBlock', c: [['', ['python'], []], 'third = 3\nfourth = 4\n'] },
    { t: 'Para', c: [str('Done')] },
  ])
})

test('quote keeps the BlockQuote and drops the edge SoftBreak', () => {
  const out = cutTree(QUOTE, at(QUOTE, 'one'), upTo(QUOTE, 'quoted'))
  expect(out.blocks).toEqual([
    { t: 'BlockQuote', c: [{ t: 'Para', c: [str('one'), { t: 'SoftBreak' }, str('still'), sp, str('quoted')] }] },
  ])
  const across = cutTree(QUOTE, at(QUOTE, 'here'), upTo(QUOTE, 'After'))
  expect(across.blocks).toEqual([
    { t: 'BlockQuote', c: [{ t: 'Para', c: [str('here')] }] },
    { t: 'Para', c: [str('After')] },
  ])
})

test('nested list keeps the outer item around a surviving inner item', () => {
  const out = cutTree(NESTED, at(NESTED, 'beta'), upTo(NESTED, 'outer', 1))
  expect(out.blocks).toEqual([
    {
      t: 'BulletList',
      c: [
        [{ t: 'BulletList', c: [[{ t: 'Plain', c: [str('beta')] }]] }],
        [{ t: 'Plain', c: [str('outer')] }],
      ],
    },
  ])
})

test('whitespace at the edges of a range is dropped', () => {
  const out = cutTree(GARDEN, at(GARDEN, 'needs'), upTo(GARDEN, 'watering'))
  expect(out.blocks).toEqual([{ t: 'Para', c: [str('needs'), sp, str('watering')] }])
})

test('a horizontal rule stays only when strictly between', () => {
  const across = cutTree(RULE, at(RULE, 'line'), upTo(RULE, 'Below'))
  expect(across.blocks).toEqual([{ t: 'Para', c: [str('line')] }, { t: 'HorizontalRule' }, { t: 'Para', c: [str('Below')] }])
  const before = cutTree(RULE, at(RULE, 'Below'), upTo(RULE, 'line', 1))
  expect(before.blocks.some((b) => b.t === 'HorizontalRule')).toBe(false)
})

test('inline code is trimmed and a link keeps its target', () => {
  const out = cutTree(LINKED, at(LINKED, 'test'), upTo(LINKED, 'the'))
  expect(out.blocks).toEqual([
    {
      t: 'Para',
      c: [
        { t: 'Code', c: [['', [], []], 'test'] },
        sp,
        str('and'),
        sp,
        { t: 'Link', c: [['', [], []], [str('the')], ['https://example.com/docs', '']] },
      ],
    },
  ])
})

test('an end on an emoji keeps the whole code point', () => {
  const out = cutTree(STARS, at(STARS, 'ars'), at(STARS, '🌟'))
  expect(out.blocks).toEqual([{ t: 'Para', c: [str('ars'), sp, str('🌟')] }])
})

test('an unknown node is kept whole when a leaf inside it is in range', () => {
  const figure: PNode = { t: 'Figure', c: [['', [], []], [{ t: 'Plain', c: [str('caption'), sp, str('words')] }]] }
  const d = doc([{ t: 'Para', c: [str('Intro'), sp, str('text')] }, figure, { t: 'Para', c: [str('Outro')] }])
  const touched = cutTree(d, at(d, 'text'), upTo(d, 'caption'))
  expect(touched.blocks).toEqual([{ t: 'Para', c: [str('text')] }, figure])
  const missed = cutTree(d, at(d, 'Intro'), upTo(d, 'text'))
  expect(missed.blocks).toEqual([{ t: 'Para', c: [str('Intro'), sp, str('text')] }])
})

test('never mutates its input', () => {
  const docs = [GARDEN, JACKET, SHOPPING, BAKING, PLAN, PRICES, CODE, QUOTE, NESTED, RULE, LINKED]
  const before = JSON.stringify(docs)
  cutTree(BAKING, at(BAKING, 'Mix'), upTo(BAKING, 'twenty'))
  cutTree(PRICES, at(PRICES, 'ngo'), upTo(PRICES, 'prices'))
  cutTree(CODE, at(CODE, 'cond'), at(CODE, '= 3'))
  cutTree(NESTED, at(NESTED, 'beta'), upTo(NESTED, 'outer', 1))
  cutTree(JACKET, at(JACKET, 'ck'), upTo(JACKET, 'jack'))
  const out = cutTree(PLAN, at(PLAN, 'here'), upTo(PLAN, 'easy'))
  ;(out.blocks[0]!.c[2] as PNode[]).push(str('changed'))
  const whole = cutTree(PRICES, at(PRICES, 'Prices'), upTo(PRICES, 'coins.'))
  whole.blocks[1]!.c[1].push({ t: 'AlignCenter' })
  expect(JSON.stringify(docs)).toBe(before)
})

// - Pack the car\n  - Hiking boots that are already broken in\n  - Rain gear\n    - warm jackets for the cold\n- Food
const PACKING = doc([{ t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'Pack' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'car' }] }, { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'Hiking' }, { t: 'Space' }, { t: 'Str', c: 'boots' }, { t: 'Space' }, { t: 'Str', c: 'that' }, { t: 'Space' }, { t: 'Str', c: 'are' }, { t: 'Space' }, { t: 'Str', c: 'already' }, { t: 'Space' }, { t: 'Str', c: 'broken' }, { t: 'Space' }, { t: 'Str', c: 'in' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Rain' }, { t: 'Space' }, { t: 'Str', c: 'gear' }] }, { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'warm' }, { t: 'Space' }, { t: 'Str', c: 'jackets' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'cold' }] }]] }]] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Food' }] }]] }])

// 1. Install it\n   1. Download the file\n   2. Run it as an admin\n2. Done
const INSTALL = doc([{ t: 'OrderedList', c: [[1, { t: 'DefaultStyle' }, { t: 'Period' }], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Install' }, { t: 'Space' }, { t: 'Str', c: 'it' }] }, { t: 'OrderedList', c: [[1, { t: 'DefaultStyle' }, { t: 'Period' }], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Download' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'file' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Run' }, { t: 'Space' }, { t: 'Str', c: 'it' }, { t: 'Space' }, { t: 'Str', c: 'as' }, { t: 'Space' }, { t: 'Str', c: 'an' }, { t: 'Space' }, { t: 'Str', c: 'admin' }] }]]] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Done' }] }]]] }])

const cutFor = (d: PandocDoc, highlight: string): PandocDoc => {
  const m = matchHighlight(d, highlight)
  if (!m) throw new Error(`no match for ${highlight}`)
  return cutTree(d, m.start, m.end)
}

function hasWrapper(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasWrapper)
  if (!node || typeof node !== 'object') return false
  const n = node as PNode
  const items = n.t === 'BulletList' ? n.c : n.t === 'OrderedList' ? n.c[1] : null
  const only = items && items.length === 1 && items[0].length === 1 ? items[0][0] : null
  if (only && (only.t === 'BulletList' || only.t === 'OrderedList')) return true
  return hasWrapper(n.c)
}

test('a sub-item highlight becomes one flat list, not a list inside a list', () => {
  const out = cutFor(PACKING, 'Hiking boots that are already broken in')
  expect(out.blocks).toEqual([
    {
      t: 'BulletList',
      c: [[{ t: 'Plain', c: [str('Hiking'), sp, str('boots'), sp, str('that'), sp, str('are'), sp, str('already'), sp, str('broken'), sp, str('in')] }]],
    },
  ])
  expect(hasWrapper(out.blocks)).toBe(false)
  expect(toPlain(out.blocks)).toBe('- Hiking boots that are already broken in')
})

test('a few words deep in a sub-item collapse every wrapper level', () => {
  const d = PACKING
  const out = cutTree(d, at(d, 'warm'), upTo(d, 'the', 1))
  expect(out.blocks).toEqual([
    { t: 'BulletList', c: [[{ t: 'Plain', c: [str('warm'), sp, str('jackets'), sp, str('for'), sp, str('the')] }]] },
  ])
  expect(toPlain(out.blocks)).toBe('- warm jackets for the')
})

test('an ordered sub-item keeps its own start number', () => {
  const out = cutFor(INSTALL, 'Run it as an admin')
  expect(out.blocks).toEqual([
    {
      t: 'OrderedList',
      c: [
        [2, { t: 'DefaultStyle' }, { t: 'Period' }],
        [[{ t: 'Plain', c: [str('Run'), sp, str('it'), sp, str('as'), sp, str('an'), sp, str('admin')] }]],
      ],
    },
  ])
  expect(toPlain(out.blocks)).toBe('2. Run it as an admin')
})

test('a cut from a sub-item into the next top-level item keeps the outer list', () => {
  const out = cutTree(INSTALL, at(INSTALL, 'Run'), upTo(INSTALL, 'Done'))
  expect(out.blocks).toHaveLength(1)
  const list = out.blocks[0]!
  expect(list.t).toBe('OrderedList')
  const items = list.c[1] as PNode[][]
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveLength(1)
  expect(items[0]![0]!.t).toBe('OrderedList')
  expect(items[0]![0]!.c[0][0]).toBe(2)
  expect(items[1]).toEqual([{ t: 'Plain', c: [str('Done')] }])
})

test('a bullet cut from two sub-items into the next top-level item keeps two outer items', () => {
  const out = cutTree(PACKING, at(PACKING, 'Hiking'), upTo(PACKING, 'Food'))
  const list = out.blocks[0]!
  expect(out.blocks).toHaveLength(1)
  expect(list.c).toHaveLength(2)
  expect(list.c[0]).toHaveLength(1)
  expect(list.c[0][0].t).toBe('BulletList')
  expect(list.c[0][0].c).toHaveLength(2)
})

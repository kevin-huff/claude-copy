import { expect, test } from 'claude-code/testing'

import type { PandocDoc } from '../types'
import { runCopy } from '../hooks/copy'
import { widenEnd, widenStart } from '../hooks/edges'
import { clearPowerShellPath } from '../hooks/clipboard'
import { clearTreeCache } from '../hooks/pandoc'
import { TREES, fakeSession } from './fixtures/session'

const doc = (blocks: PandocDoc['blocks']): PandocDoc => ({ 'pandoc-api-version': [1, 20], meta: {}, blocks })

// pandoc 2.9.2.1, -f gfm -t json, on invented markdown

// Then run `npm test`.
const CODE = doc([{ t: 'Para', c: [{ t: 'Str', c: 'Then' }, { t: 'Space' }, { t: 'Str', c: 'run' }, { t: 'Space' }, { t: 'Code', c: [['', [], []], 'npm test'] }, { t: 'Str', c: '.' }] }])

// Did you see **the note**? It matters.
const NOTE = doc([{ t: 'Para', c: [{ t: 'Str', c: 'Did' }, { t: 'Space' }, { t: 'Str', c: 'you' }, { t: 'Space' }, { t: 'Str', c: 'see' }, { t: 'Space' }, { t: 'Strong', c: [{ t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'note' }] }, { t: 'Str', c: '?' }, { t: 'Space' }, { t: 'Str', c: 'It' }, { t: 'Space' }, { t: 'Str', c: 'matters.' }] }])

// Some text (**important**: back up first) here.
const PAREN = doc([{ t: 'Para', c: [{ t: 'Str', c: 'Some' }, { t: 'Space' }, { t: 'Str', c: 'text' }, { t: 'Space' }, { t: 'Str', c: '(' }, { t: 'Strong', c: [{ t: 'Str', c: 'important' }] }, { t: 'Str', c: ':' }, { t: 'Space' }, { t: 'Str', c: 'back' }, { t: 'Space' }, { t: 'Str', c: 'up' }, { t: 'Space' }, { t: 'Str', c: 'first)' }, { t: 'Space' }, { t: 'Str', c: 'here.' }] }])

// ✅ **Done:** the tests pass
const DONE = doc([{ t: 'Para', c: [{ t: 'Str', c: '✅' }, { t: 'Space' }, { t: 'Strong', c: [{ t: 'Str', c: 'Done' }, { t: 'Str', c: ':' }] }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'tests' }, { t: 'Space' }, { t: 'Str', c: 'pass' }] }])

// We shipped it today 🎉
const PARTY = doc([{ t: 'Para', c: [{ t: 'Str', c: 'We' }, { t: 'Space' }, { t: 'Str', c: 'shipped' }, { t: 'Space' }, { t: 'Str', c: 'it' }, { t: 'Space' }, { t: 'Str', c: 'today' }, { t: 'Space' }, { t: 'Str', c: '🎉' }] }])

// - [ ] Book the room
const TASK = doc([{ t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: '☐' }, { t: 'Space' }, { t: 'Str', c: 'Book' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'room' }] }]] }])

// Open the door.
const DOOR = doc([{ t: 'Para', c: [{ t: 'Str', c: 'Open' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'door.' }] }])

// ("Quoted words
const QUOTE = doc([{ t: 'Para', c: [{ t: 'Str', c: '("Quoted' }, { t: 'Space' }, { t: 'Str', c: 'words' }] }])

// Line one\nLine two.  (soft break)  then a second paragraph.
const SOFT = doc([
  { t: 'Para', c: [{ t: 'Str', c: 'See' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Emph', c: [{ t: 'Str', c: 'guide' }] }, { t: 'SoftBreak' }, { t: 'Str', c: '...' }] },
  { t: 'Para', c: [{ t: 'Str', c: '...' }, { t: 'Space' }, { t: 'Str', c: 'next' }] },
])

test('the end widens from code onto the full stop', () => {
  expect(widenEnd(CODE, { path: [0, 'c', 4], offset: 7 }, '.')).toEqual({ path: [0, 'c', 5], offset: 0 })
})

test('the end widens across a closing tag to the question mark', () => {
  expect(widenEnd(NOTE, { path: [0, 'c', 6, 'c', 2], offset: 3 }, '?')).toEqual({ path: [0, 'c', 7], offset: 0 })
})

test('the start widens across nodes to the opening parenthesis', () => {
  expect(widenStart(PAREN, { path: [0, 'c', 5, 'c', 0], offset: 0 }, '(')).toEqual({ path: [0, 'c', 4], offset: 0 })
})

test('the start widens across a space to the emoji', () => {
  expect(widenStart(DONE, { path: [0, 'c', 2, 'c', 0], offset: 0 }, '✅ ')).toEqual({ path: [0, 'c', 0], offset: 0 })
})

test('the end widens across a space to a trailing emoji and keeps it whole', () => {
  expect(widenEnd(PARTY, { path: [0, 'c', 6], offset: 4 }, ' 🎉')).toEqual({ path: [0, 'c', 8], offset: 0 })
})

test('the start widens to the task box and stays inside the item', () => {
  expect(widenStart(TASK, { path: [0, 'c', 0, 0, 'c', 2], offset: 0 }, '- ☐ ')).toEqual({ path: [0, 'c', 0, 0, 'c', 0], offset: 0 })
})

test('no space is crossed when the edge has no whitespace', () => {
  expect(widenStart(DONE, { path: [0, 'c', 2, 'c', 0], offset: 0 }, '')).toEqual({ path: [0, 'c', 2, 'c', 0], offset: 0 })
  expect(widenStart(DONE, { path: [0, 'c', 2, 'c', 0], offset: 0 }, '✅')).toEqual({ path: [0, 'c', 2, 'c', 0], offset: 0 })
  expect(widenEnd(PARTY, { path: [0, 'c', 6], offset: 4 }, '🎉')).toEqual({ path: [0, 'c', 6], offset: 4 })
})

test('a mismatch leaves the spot alone', () => {
  expect(widenEnd(NOTE, { path: [0, 'c', 6, 'c', 2], offset: 3 }, '!')).toEqual({ path: [0, 'c', 6, 'c', 2], offset: 3 })
  expect(widenStart(PAREN, { path: [0, 'c', 5, 'c', 0], offset: 0 }, '[')).toEqual({ path: [0, 'c', 5, 'c', 0], offset: 0 })
})

test('it behaves as before inside a single node', () => {
  expect(widenEnd(DOOR, { path: [0, 'c', 4], offset: 3 }, '.')).toEqual({ path: [0, 'c', 4], offset: 4 })
  expect(widenStart(QUOTE, { path: [0, 'c', 0], offset: 2 }, '("')).toEqual({ path: [0, 'c', 0], offset: 0 })
})

test('it never leaves the block', () => {
  expect(widenEnd(SOFT, { path: [0, 'c', 4, 'c', 0], offset: 4 }, '\n...')).toEqual({ path: [0, 'c', 6], offset: 2 })
  expect(widenEnd(SOFT, { path: [0, 'c', 6], offset: 2 }, '\n\n...')).toEqual({ path: [0, 'c', 6], offset: 2 })
  expect(widenStart(SOFT, { path: [1, 'c', 2], offset: 0 }, '...  ')).toEqual({ path: [1, 'c', 0], offset: 0 })
})

// ```\nalpha\n    beta\ngamma\n```
const FENCE_MD = '```\nalpha\n    beta\ngamma\n```'
const FENCE = doc([{ t: 'CodeBlock', c: [['', [], []], 'alpha\n    beta\ngamma\n'] }])

test('the end never moves onto whitespace in a code block', () => {
  const spot = { path: [0], offset: 4 }
  expect(widenEnd(FENCE, spot, '\n  ')).toEqual(spot)
})

test('the start never moves onto whitespace in a code block', () => {
  const spot = { path: [0], offset: 10 }
  expect(widenStart(FENCE, spot, '\n    ')).toEqual(spot)
})

test('a code highlight ending in newline and indentation copies only its line', async () => {
  clearTreeCache()
  clearPowerShellPath()
  TREES[FENCE_MD] = FENCE
  const s = fakeSession({ replies: [FENCE_MD], selection: { text: 'alpha\n  ' } })
  await runCopy(s.$, { n: null, variant: 'plain', command: '/rcopy', busy: false, fullscreen: true }, { defaultVariant: 'rich', tableBorders: true, codeColors: true })
  expect(s.copies[0]).toContain('alpha')
  expect(s.copies[0]).not.toContain('beta')
})

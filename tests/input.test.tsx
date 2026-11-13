import { expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'
import { parseArgs, settingsFrom, splitReplies, toolRow } from '../hooks/input'

const user = (text: string, toolResults?: SessionMessage['toolResults']) =>
  ({ role: 'user', text, toolUses: [], toolResults }) as unknown as SessionMessage
const bot = (text: string, ids: string[] = []) =>
  ({ role: 'assistant', text, toolUses: ids.map((tool_use_id) => ({ tool_use_id })) }) as unknown as SessionMessage

test('parseArgs accepts the copy grammar', () => {
  expect(parseArgs('')).toEqual({ kind: 'copy', n: null, variant: null })
  expect(parseArgs('2')).toEqual({ kind: 'copy', n: 2, variant: null })
  expect(parseArgs('md')).toEqual({ kind: 'copy', n: null, variant: 'md' })
  expect(parseArgs('2 md')).toEqual({ kind: 'copy', n: 2, variant: 'md' })
  expect(parseArgs('MD 2')).toEqual({ kind: 'copy', n: 2, variant: 'md' })
  expect(parseArgs('markdown')).toEqual({ kind: 'copy', n: null, variant: 'md' })
  expect(parseArgs('formatted')).toEqual({ kind: 'copy', n: null, variant: 'rich' })
  expect(parseArgs('text 999')).toEqual({ kind: 'copy', n: 999, variant: 'plain' })
  expect(parseArgs('html')).toEqual({ kind: 'copy', n: null, variant: 'html' })
})

test('parseArgs handles help and doctor', () => {
  expect(parseArgs('help')).toEqual({ kind: 'help' })
  expect(parseArgs('doctor')).toEqual({ kind: 'doctor' })
})

test('parseArgs names the first bad word', () => {
  expect(parseArgs('0')).toEqual({ kind: 'bad', word: '0' })
  expect(parseArgs('2 3')).toEqual({ kind: 'bad', word: '3' })
  expect(parseArgs('md plain')).toEqual({ kind: 'bad', word: 'plain' })
  expect(parseArgs('help 2')).toEqual({ kind: 'bad', word: 'help' })
  expect(parseArgs('bogus')).toEqual({ kind: 'bad', word: 'bogus' })
  expect(parseArgs('1000')).toEqual({ kind: 'bad', word: '1000' })
  expect(parseArgs('2 doctor')).toEqual({ kind: 'bad', word: 'doctor' })
})

test('parseArgs names a bad word as typed', () => {
  expect(parseArgs('FOO')).toEqual({ kind: 'bad', word: 'FOO' })
  expect(parseArgs('2 Bogus')).toEqual({ kind: 'bad', word: 'Bogus' })
  expect(parseArgs('MD 2')).toEqual({ kind: 'copy', n: 2, variant: 'md' })
})

test('settingsFrom defaults and rejects bad values', () => {
  expect(settingsFrom({})).toEqual({ defaultVariant: 'rich', tableBorders: true, codeColors: true })
  expect(settingsFrom({ defaultVariant: 'md', tableBorders: false, codeColors: false })).toEqual({
    defaultVariant: 'md',
    tableBorders: false,
    codeColors: false,
  })
  expect(settingsFrom({ defaultVariant: 'pdf', tableBorders: 'no', codeColors: 1 })).toEqual({
    defaultVariant: 'rich',
    tableBorders: true,
    codeColors: true,
  })
})

test('splitReplies keeps a reply whole across tool calls', () => {
  const r = splitReplies([
    user('first question'),
    bot('Looking.', ['toolu_1']),
    user('', [{ tool_use_id: 'toolu_1', text: 'ok', isError: false }] as any),
    bot('Done.'),
  ])
  expect(r).toEqual([{ index: 1, markdown: 'Looking.\n\nDone.' }])
})

test('splitReplies ignores command records and reminders', () => {
  const r = splitReplies([
    user('question'),
    bot('Part one.'),
    user('<command-name>/foo</command-name>'),
    user('<system-reminder>note</system-reminder>'),
    bot('Part two.'),
  ])
  expect(r).toEqual([{ index: 1, markdown: 'Part one.\n\nPart two.' }])
})

test('splitReplies numbers newest first and skips empty text', () => {
  const r = splitReplies([user('a'), bot('old'), user('b'), bot('  '), bot('mid'), user('c'), bot('new'), user('d'), bot('')])
  expect(r).toEqual([
    { index: 1, markdown: 'new' },
    { index: 2, markdown: 'mid' },
    { index: 3, markdown: 'old' },
  ])
})

test('toolRow matches ids and the toolu_ prefix', () => {
  const msgs = [
    bot('x', ['abc']),
    user('', [{ tool_use_id: 'def', text: '', isError: false }] as any),
  ]
  expect(toolRow('abc', msgs)).toBe(true)
  expect(toolRow('def', msgs)).toBe(true)
  expect(toolRow('toolu_zzz', [])).toBe(true)
  expect(toolRow('msg_1', msgs)).toBe(false)
  expect(toolRow(undefined, msgs)).toBe(false)
})

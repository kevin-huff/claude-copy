import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import type { PandocDoc } from '../types'
import { clearTreeCache, pandocVersion, toGfm, toHtml, toTree } from '../hooks/pandoc'

type Call = { argv: readonly string[]; stdin: string | undefined; timeoutMs: number | undefined }
type Reply = { exitCode: number; stdout: string; stderr: string } | Error

function fake(reply: Reply | ((argv: readonly string[]) => Reply)) {
  const calls: Call[] = []
  const $ = {
    process: {
      run: async (argv: readonly string[], init: { stdin?: string; timeoutMs?: number }) => {
        calls.push({ argv, stdin: init.stdin, timeoutMs: init.timeoutMs })
        const r = typeof reply === 'function' ? reply(argv) : reply
        if (r instanceof Error) throw r
        return r
      },
    },
  } as unknown as EngineInterface
  return { $, calls }
}

const ok = (stdout: string): Reply => ({ exitCode: 0, stdout, stderr: '' })

const boldTree =
  '{"blocks":[{"t":"Para","c":[{"t":"Str","c":"Hello"},{"t":"Space"},{"t":"Strong","c":[{"t":"Str","c":"bold"}]}]}],"pandoc-api-version":[1,20],"meta":{}}'
const boldDoc = JSON.parse(boldTree) as PandocDoc

const twoLists =
  '{"blocks":[{"t":"BulletList","c":[[{"t":"Plain","c":[{"t":"Str","c":"one"}]}],[{"t":"Plain","c":[{"t":"Str","c":"two"}]}]]},{"t":"OrderedList","c":[[1,{"t":"DefaultStyle"},{"t":"Period"}],[[{"t":"Plain","c":[{"t":"Str","c":"first"}]}],[{"t":"Plain","c":[{"t":"Str","c":"second"}]}]]]}],"pandoc-api-version":[1,20],"meta":{}}'
const twoListsGfm = '  - one\n  - two\n\n<!-- end list -->\n\n1.  first\n2.  second\n'

test('toTree runs pandoc with the markdown on stdin and parses the JSON', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok(boldTree))
  const ran = await toTree($, 'Hello **bold**')
  expect(ran).toEqual({ ok: true, value: boldDoc })
  expect(calls).toEqual([{ argv: ['pandoc', '-f', 'gfm+hard_line_breaks-emoji', '-t', 'json'], stdin: 'Hello **bold**', timeoutMs: 5000 }])
})

test('toTree keeps each line break of stacked labels and a sign-off', async () => {
  clearTreeCache()
  const md = '**When:** Tuesday at 10am\n**Where:** Room 4B\n**Bring:** a laptop\n\nThanks,\nAlex'
  const tree =
    '{"blocks":[{"t":"Para","c":[{"t":"Strong","c":[{"t":"Str","c":"When:"}]},{"t":"Space"},{"t":"Str","c":"Tuesday"},{"t":"Space"},{"t":"Str","c":"at"},{"t":"Space"},{"t":"Str","c":"10am"},{"t":"LineBreak"},{"t":"Strong","c":[{"t":"Str","c":"Where:"}]},{"t":"Space"},{"t":"Str","c":"Room"},{"t":"Space"},{"t":"Str","c":"4B"},{"t":"LineBreak"},{"t":"Strong","c":[{"t":"Str","c":"Bring:"}]},{"t":"Space"},{"t":"Str","c":"a"},{"t":"Space"},{"t":"Str","c":"laptop"}]},{"t":"Para","c":[{"t":"Str","c":"Thanks,"},{"t":"LineBreak"},{"t":"Str","c":"Alex"}]}],"pandoc-api-version":[1,20],"meta":{}}'
  const { $, calls } = fake(ok(tree))
  const ran = await toTree($, md)
  expect(ran.ok).toBe(true)
  if (ran.ok) expect(ran.value.blocks.length).toBe(2)
  expect(calls).toEqual([{ argv: ['pandoc', '-f', 'gfm+hard_line_breaks-emoji', '-t', 'json'], stdin: md, timeoutMs: 5000 }])
})

test('toTree answers a repeated input from the cache without running pandoc', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok(boldTree))
  await toTree($, 'Hello **bold**')
  const again = await toTree($, 'Hello **bold**')
  expect(again).toEqual({ ok: true, value: boldDoc })
  expect(calls.length).toBe(1)
})

test('clearTreeCache makes the next toTree run pandoc again', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok(boldTree))
  await toTree($, 'a')
  clearTreeCache()
  await toTree($, 'a')
  expect(calls.length).toBe(2)
})

test('toTree keeps the newest 32 inputs and drops the oldest', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok(boldTree))
  for (let i = 0; i < 32; i++) await toTree($, `doc ${i}`)
  await toTree($, 'doc 0')
  expect(calls.length).toBe(32)
  await toTree($, 'doc 32')
  expect(calls.length).toBe(33)
  await toTree($, 'doc 0')
  expect(calls.length).toBe(33)
  await toTree($, 'doc 1')
  expect(calls.length).toBe(34)
})

test('toTree does not cache failures', async () => {
  clearTreeCache()
  const { $, calls } = fake({ exitCode: 1, stdout: '', stderr: 'boom' })
  await toTree($, 'x')
  await toTree($, 'x')
  expect(calls.filter((c) => c.argv.includes('json')).length).toBe(2)
})

test('toTree reports a missing pandoc', async () => {
  clearTreeCache()
  const { $ } = fake(new Error('spawn pandoc ENOENT'))
  const ran = await toTree($, 'x')
  expect(ran.ok).toBe(false)
  if (!ran.ok) {
    expect(ran.failure.program).toBe('pandoc')
    expect(ran.failure.kind).toBe('missing')
  }
})

test('toTree reports a failed run with the first stderr line', async () => {
  clearTreeCache()
  const { $ } = fake({ exitCode: 1, stdout: '', stderr: 'pandoc: bad input\nmore detail\n' })
  const ran = await toTree($, 'x')
  expect(ran).toEqual({ ok: false, failure: { program: 'pandoc', kind: 'failed', detail: 'pandoc: bad input' } })
})

test('toTree reports a timeout', async () => {
  clearTreeCache()
  const { $ } = fake(new Error('timed out'))
  const ran = await toTree($, 'x')
  expect(ran.ok).toBe(false)
  if (!ran.ok) expect(ran.failure.kind).toBe('timeout')
})

test('toTree rejects output that is not JSON', async () => {
  clearTreeCache()
  const { $ } = fake(ok('not json'))
  const ran = await toTree($, 'x')
  expect(ran).toEqual({ ok: false, failure: { program: 'pandoc', kind: 'failed', detail: 'unreadable pandoc output' } })
})

test('toTree rejects JSON without a blocks array', async () => {
  clearTreeCache()
  const { $ } = fake(ok('{"meta":{}}'))
  const ran = await toTree($, 'x')
  expect(ran).toEqual({ ok: false, failure: { program: 'pandoc', kind: 'failed', detail: 'unreadable pandoc output' } })
})

test('toHtml sends the tree as JSON and trims trailing newlines', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok('<p>Hello <strong>bold</strong></p>\n\n'))
  const ran = await toHtml($, boldDoc)
  expect(ran).toEqual({ ok: true, value: '<p>Hello <strong>bold</strong></p>' })
  expect(calls).toEqual([
    { argv: ['pandoc', '-f', 'json', '-t', 'html', '--wrap=none'], stdin: JSON.stringify(boldDoc), timeoutMs: 5000 },
  ])
})

test('toHtml passes failures through', async () => {
  clearTreeCache()
  const { $ } = fake({ exitCode: 2, stdout: '', stderr: 'bad tree' })
  const ran = await toHtml($, boldDoc)
  expect(ran).toEqual({ ok: false, failure: { program: 'pandoc', kind: 'failed', detail: 'bad tree' } })
})

test('toGfm sends the tree as JSON with the gfm writer', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok('Hello **bold**\n'))
  const ran = await toGfm($, boldDoc)
  expect(ran).toEqual({ ok: true, value: 'Hello **bold**' })
  expect(calls).toEqual([
    { argv: ['pandoc', '-f', 'json', '-t', 'gfm+hard_line_breaks', '--wrap=none'], stdin: JSON.stringify(boldDoc), timeoutMs: 5000 },
  ])
})

test('toGfm removes the end-list comment pandoc puts between adjacent lists', async () => {
  clearTreeCache()
  const doc = JSON.parse(twoLists) as PandocDoc
  const { $ } = fake(ok(twoListsGfm))
  const ran = await toGfm($, doc)
  expect(ran).toEqual({ ok: true, value: '  - one\n  - two\n\n1.  first\n2.  second' })
})

test('toGfm keeps a comment that is not exactly the end-list marker', async () => {
  clearTreeCache()
  const { $ } = fake(ok('a\n\n<!-- note -->\n\nb\n'))
  const ran = await toGfm($, boldDoc)
  expect(ran).toEqual({ ok: true, value: 'a\n\n<!-- note -->\n\nb' })
})

test('pandocVersion runs --version and reads the version word', async () => {
  clearTreeCache()
  const { $, calls } = fake(ok('pandoc 2.9.2.1\nCompiled with pandoc-types 1.20\n'))
  const ran = await pandocVersion($)
  expect(ran).toEqual({ ok: true, value: '2.9.2.1' })
  expect(calls).toEqual([{ argv: ['pandoc', '--version'], stdin: undefined, timeoutMs: 5000 }])
})

test('pandocVersion fails on output that is not a version line', async () => {
  clearTreeCache()
  const { $ } = fake(ok('something else\n'))
  const ran = await pandocVersion($)
  expect(ran.ok).toBe(false)
  if (!ran.ok) expect(ran.failure.kind).toBe('failed')
})

test('pandocVersion reports a missing pandoc', async () => {
  clearTreeCache()
  const { $ } = fake(new Error('spawn pandoc ENOENT'))
  const ran = await pandocVersion($)
  expect(ran.ok).toBe(false)
  if (!ran.ok) expect(ran.failure.kind).toBe('missing')
})

test('toTree keeps :wave: as typed text with the emoji extension off', async () => {
  clearTreeCache()
  const tree =
    '{"blocks":[{"t":"Para","c":[{"t":"Str","c":"Hey"},{"t":"Space"},{"t":"Str","c":"team"},{"t":"Space"},{"t":"Str","c":":wave:"}]}],"pandoc-api-version":[1,20],"meta":{}}'
  const { $, calls } = fake(ok(tree))
  const ran = await toTree($, 'Hey team :wave:')
  expect(ran.ok).toBe(true)
  if (ran.ok) expect(ran.value.blocks[0]).toEqual({ t: 'Para', c: [{ t: 'Str', c: 'Hey' }, { t: 'Space' }, { t: 'Str', c: 'team' }, { t: 'Space' }, { t: 'Str', c: ':wave:' }] })
  expect(calls[0]?.argv).toEqual(['pandoc', '-f', 'gfm+hard_line_breaks-emoji', '-t', 'json'])
})

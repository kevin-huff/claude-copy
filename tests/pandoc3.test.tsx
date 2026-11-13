import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import type { PandocDoc } from '../types'
import { clearTreeCache, toGfm, toTree } from '../hooks/pandoc'
import { toPlain } from '../hooks/plain'

// pandoc 3 reads gfm into a few shapes pandoc 2.9 never makes. The trees and the extension list below are real
// pandoc 3.1.3 output (the version Ubuntu 24.04 installs) for the invented markdown next to them.

type Reply = { exitCode: number; stdout: string; stderr: string }

function fake(answer: (argv: readonly string[]) => Reply) {
  const calls: string[] = []
  const $ = {
    process: {
      run: async (argv: readonly string[]) => {
        calls.push(argv.join(' '))
        return answer(argv)
      },
    },
  } as unknown as EngineInterface
  return { $, calls }
}

const ok = (stdout: string): Reply => ({ exitCode: 0, stdout, stderr: '' })

const MIXED_MD = "- [ ] Pack the boxes\n- Buy more tape\n- [x] Call the landlord\n"
const MIXED_TREE = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☐\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Pack\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"boxes\"}]}]]},{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Buy\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"more\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"tape\"}]}]]},{\"t\":\"BulletList\",\"c\":[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"☒\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Call\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"landlord\"}]}]]}]}"

const MATH_MD = "Run echo $A$B to print both.\n"
const MATH_TREE = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Run\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"echo\"},{\"t\":\"Space\"},{\"t\":\"Math\",\"c\":[{\"t\":\"InlineMath\"},\"A\"]},{\"t\":\"Str\",\"c\":\"B\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"print\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"both.\"}]}]}"
const MATH_TREE_STRICT = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Run\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"echo\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"$A$B\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"print\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"both.\"}]}]}"

const EXTENSIONS_3 = "-ascii_identifiers\n-attributes\n+autolink_bare_uris\n-bracketed_spans\n-definition_lists\n-east_asian_line_breaks\n+emoji\n-fancy_lists\n-fenced_divs\n+footnotes\n+gfm_auto_identifiers\n-hard_line_breaks\n-implicit_figures\n-implicit_header_references\n+pipe_tables\n-raw_attribute\n+raw_html\n-rebase_relative_paths\n-smart\n-sourcepos\n+strikeout\n-subscript\n-superscript\n+task_lists\n+tex_math_dollars\n-wikilinks_title_after_pipe\n-wikilinks_title_before_pipe\n+yaml_metadata_block\n"
const EXTENSIONS_29 = "+all_symbols_escapable\n-ascii_identifiers\n+auto_identifiers\n+autolink_bare_uris\n+backtick_code_blocks\n-east_asian_line_breaks\n+emoji\n+fenced_code_blocks\n+gfm_auto_identifiers\n-hard_line_breaks\n+intraword_underscores\n+lists_without_preceding_blankline\n+pipe_tables\n+raw_html\n-raw_tex\n+shortcut_reference_links\n-smart\n+space_in_atx_header\n+strikeout\n+task_lists\n"

const EMPTY_HEAD_TREE = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"Table\",\"c\":[[\"\",[],[]],[null,[]],[[{\"t\":\"AlignDefault\"},{\"t\":\"ColWidthDefault\"}],[{\"t\":\"AlignDefault\"},{\"t\":\"ColWidthDefault\"}]],[[\"\",[],[]],[[[\"\",[],[]],[[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[]],[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[]]]]]],[[[\"\",[],[]],0,[],[[[\"\",[],[]],[[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Mon\"}]}]],[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Pack\"}]}]]]],[[\"\",[],[]],[[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Tue\"}]}]],[[\"\",[],[]],{\"t\":\"AlignDefault\"},1,1,[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Drive\"}]}]]]]]]],[[\"\",[],[]],[]]]}]}"

test('a list that pandoc 3 splits at its task items comes back as one list', async () => {
  clearTreeCache()
  const { $, calls } = fake(() => ok(MIXED_TREE))
  const ran = await toTree($, MIXED_MD)
  expect(ran.ok).toBe(true)
  if (!ran.ok) return
  expect(ran.value.blocks.map((b) => b.t)).toEqual(['BulletList'])
  expect(toPlain(ran.value.blocks)).toBe('- \u2610 Pack the boxes\n- Buy more tape\n- \u2611 Call the landlord')
  expect(calls).toEqual(['pandoc -f gfm+hard_line_breaks-emoji -t json'])
})

test('two plain lists side by side stay apart', async () => {
  clearTreeCache()
  const { $ } = fake(() => ok("{\"blocks\": [{\"t\": \"BulletList\", \"c\": [[{\"t\": \"Plain\", \"c\": [{\"t\": \"Str\", \"c\": \"one\"}]}]]}, {\"t\": \"BulletList\", \"c\": [[{\"t\": \"Plain\", \"c\": [{\"t\": \"Str\", \"c\": \"two\"}]}]]}], \"pandoc-api-version\": [1, 20], \"meta\": {}}"))
  const ran = await toTree($, '- one\n\n* two\n')
  expect(ran.ok && ran.value.blocks.map((b) => b.t)).toEqual(['BulletList', 'BulletList'])
})

test('a tree with math is read again with the extensions Claude Code shows as typed turned off', async () => {
  clearTreeCache()
  const { $, calls } = fake((argv) =>
    argv.includes('--list-extensions=gfm') ? ok(EXTENSIONS_3) : argv[2] === 'gfm+hard_line_breaks-emoji' ? ok(MATH_TREE) : ok(MATH_TREE_STRICT),
  )
  const ran = await toTree($, MATH_MD)
  expect(calls).toEqual([
    'pandoc -f gfm+hard_line_breaks-emoji -t json',
    'pandoc --list-extensions=gfm',
    'pandoc -f gfm+hard_line_breaks-emoji-footnotes-tex_math_dollars-yaml_metadata_block -t json',
  ])
  expect(ran.ok && toPlain(ran.value.blocks)).toBe('Run echo $A$B to print both.')
  await toTree($, 'Then $x$ again.\n')
  expect(calls.filter((c) => c.includes('--list-extensions')).length).toBe(1)
})

test('a pandoc that lists none of those extensions keeps the first tree', async () => {
  clearTreeCache()
  const { $, calls } = fake((argv) => (argv.includes('--list-extensions=gfm') ? ok(EXTENSIONS_29) : ok(MATH_TREE)))
  const ran = await toTree($, MATH_MD)
  expect(calls).toEqual(['pandoc -f gfm+hard_line_breaks-emoji -t json', 'pandoc --list-extensions=gfm'])
  expect(ran.ok && (ran.value as PandocDoc).blocks.length).toBe(1)
})

test('toGfm drops the empty comment pandoc 3 puts between two lists', async () => {
  const { $ } = fake(() => ok('- one\n- two\n\n<!-- -->\n\n- three\n'))
  const ran = await toGfm($, { 'pandoc-api-version': [1, 23], meta: {}, blocks: [] })
  expect(ran).toEqual({ ok: true, value: '- one\n- two\n\n- three' })
})

test('a pandoc 3 table with an empty header row gives no blank first line', () => {
  const doc = JSON.parse(EMPTY_HEAD_TREE) as PandocDoc
  expect(toPlain(doc.blocks)).toBe('Mon\tPack\nTue\tDrive')
})

test('a figure gives the text of its content', () => {
  const figure = { t: 'Figure', c: [['', [], []], [null, []], [{ t: 'Plain', c: [{ t: 'Str', c: 'Chart' }] }]] }
  expect(toPlain([figure])).toBe('Chart')
})

const NUMBERED_TASKS_MD = '1. [x] Buy seed\n2. [ ] Water the beds\n'
const NUMBERED_TASKS_TREE = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"OrderedList\",\"c\":[[1,{\"t\":\"Decimal\"},{\"t\":\"Period\"}],[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"[x]\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Buy\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"seed\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"[\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"]\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Water\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"beds\"}]}]]]}]}"

test('task boxes in a numbered list become the same boxes pandoc 2.9 makes', async () => {
  clearTreeCache()
  const { $ } = fake(() => ok(NUMBERED_TASKS_TREE))
  const ran = await toTree($, NUMBERED_TASKS_MD)
  expect(ran.ok && toPlain(ran.value.blocks)).toBe('1. \u2611 Buy seed\n2. \u2610 Water the beds')
})

const YAML_MD = "---\ntitle: Plan\nowner: Sam\n---\n\nHello there\n"
const YAML_TREE = "{\"pandoc-api-version\":[1,23],\"meta\":{\"owner\":{\"t\":\"MetaInlines\",\"c\":[{\"t\":\"Str\",\"c\":\"Sam\"}]},\"title\":{\"t\":\"MetaInlines\",\"c\":[{\"t\":\"Str\",\"c\":\"Plan\"}]}},\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hello\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"}]}]}"
const YAML_TREE_STRICT = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"HorizontalRule\"},{\"t\":\"Header\",\"c\":[2,[\"title-plan-owner-sam\",[],[]],[{\"t\":\"Str\",\"c\":\"title:\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Plan\"},{\"t\":\"LineBreak\"},{\"t\":\"Str\",\"c\":\"owner:\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Sam\"}]]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hello\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"}]}]}"
const BAD_YAML_MD = "---\nThis is not: valid: yaml\n---\n\nHello there\n"
const BAD_YAML_TREE_STRICT = "{\"pandoc-api-version\":[1,23],\"meta\":{},\"blocks\":[{\"t\":\"HorizontalRule\"},{\"t\":\"Header\",\"c\":[2,[\"this-is-not-valid-yaml\",[],[]],[{\"t\":\"Str\",\"c\":\"This\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"not:\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"valid:\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"yaml\"}]]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hello\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"there\"}]}]}"
const STRICT = 'gfm+hard_line_breaks-emoji-footnotes-tex_math_dollars-yaml_metadata_block'

test('a leading --- block that pandoc 3 takes for metadata is read again as text', async () => {
  clearTreeCache()
  const { $ } = fake((argv) => (argv.includes('--list-extensions=gfm') ? ok(EXTENSIONS_3) : argv[2] === STRICT ? ok(YAML_TREE_STRICT) : ok(YAML_TREE)))
  const ran = await toTree($, YAML_MD)
  expect(ran.ok && toPlain(ran.value.blocks)).toBe('title: Plan\nowner: Sam\n\nHello there')
})

test('a reply pandoc refuses is read again with the stricter reader', async () => {
  clearTreeCache()
  const refused = { exitCode: 64, stdout: '', stderr: 'YAML parse exception at line 1, column 18' }
  const { $, calls } = fake((argv) => (argv.includes('--list-extensions=gfm') ? ok(EXTENSIONS_3) : argv[2] === STRICT ? ok(BAD_YAML_TREE_STRICT) : refused))
  const ran = await toTree($, BAD_YAML_MD)
  expect(ran.ok).toBe(true)
  expect(calls).toEqual(['pandoc -f gfm+hard_line_breaks-emoji -t json', 'pandoc --list-extensions=gfm', `pandoc -f ${STRICT} -t json`])
})

test('a failed extension listing is tried again on the next tree', async () => {
  clearTreeCache()
  let listings = 0
  const { $ } = fake((argv) => {
    if (argv.includes('--list-extensions=gfm')) {
      listings++
      return listings === 1 ? { exitCode: 1, stdout: '', stderr: 'busy' } : ok(EXTENSIONS_3)
    }
    return ok(MATH_TREE)
  })
  await toTree($, MATH_MD)
  await toTree($, 'Then $x$ again.\n')
  expect(listings).toBe(2)
})

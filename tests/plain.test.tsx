import { expect, test } from 'claude-code/testing'
import type { PNode } from '../types'
import { describeBlocks, toPlain } from '../hooks/plain'

// Trees below are pandoc 2.9.2.1 output (-f gfm, or markdown where noted) for invented text.
const kitchenSinkMarkdown = "# Release notes\n\nThis is **bold**, *italic*, `inline code`, ~~struck~~ text with a [link](https://example.com/docs) and <https://example.org> here. Done :tada:\n\n- Fruit\n  - Apple\n  - Pear\n- Vegetables\n\n3. Third step\n4. Fourth step\n\n- [ ] Open item\n- [x] Done item\n\n> A quoted line\n> that wraps.\n\n| Name | Qty |\n|:-----|----:|\n| Bolt | 4 |\n| Nut | 12 |\n\n```js\nconst a = 1\nconsole.log(a)\n```\n\n---\n\nClosing line.\n"
const kitchenSink: PNode[] = [{"t": "Header", "c": [1, ["release-notes", [], []], [{"t": "Str", "c": "Release"}, {"t": "Space"}, {"t": "Str", "c": "notes"}]]}, {"t": "Para", "c": [{"t": "Str", "c": "This"}, {"t": "Space"}, {"t": "Str", "c": "is"}, {"t": "Space"}, {"t": "Strong", "c": [{"t": "Str", "c": "bold"}]}, {"t": "Str", "c": ","}, {"t": "Space"}, {"t": "Emph", "c": [{"t": "Str", "c": "italic"}]}, {"t": "Str", "c": ","}, {"t": "Space"}, {"t": "Code", "c": [["", [], []], "inline code"]}, {"t": "Str", "c": ","}, {"t": "Space"}, {"t": "Strikeout", "c": [{"t": "Str", "c": "struck"}]}, {"t": "Space"}, {"t": "Str", "c": "text"}, {"t": "Space"}, {"t": "Str", "c": "with"}, {"t": "Space"}, {"t": "Str", "c": "a"}, {"t": "Space"}, {"t": "Link", "c": [["", [], []], [{"t": "Str", "c": "link"}], ["https://example.com/docs", ""]]}, {"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}, {"t": "Link", "c": [["", [], []], [{"t": "Str", "c": "https"}, {"t": "Str", "c": "://example.org"}], ["https://example.org", ""]]}, {"t": "Space"}, {"t": "Str", "c": "here."}, {"t": "Space"}, {"t": "Str", "c": "Done"}, {"t": "Space"}, {"t": "Span", "c": [["", ["emoji"], [["data-emoji", "tada"]]], [{"t": "Str", "c": "🎉"}]]}]}, {"t": "BulletList", "c": [[{"t": "Plain", "c": [{"t": "Str", "c": "Fruit"}]}, {"t": "BulletList", "c": [[{"t": "Plain", "c": [{"t": "Str", "c": "Apple"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Pear"}]}]]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Vegetables"}]}]]}, {"t": "OrderedList", "c": [[3, {"t": "DefaultStyle"}, {"t": "Period"}], [[{"t": "Plain", "c": [{"t": "Str", "c": "Third"}, {"t": "Space"}, {"t": "Str", "c": "step"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Fourth"}, {"t": "Space"}, {"t": "Str", "c": "step"}]}]]]}, {"t": "BulletList", "c": [[{"t": "Plain", "c": [{"t": "Str", "c": "☐"}, {"t": "Space"}, {"t": "Str", "c": "Open"}, {"t": "Space"}, {"t": "Str", "c": "item"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "☒"}, {"t": "Space"}, {"t": "Str", "c": "Done"}, {"t": "Space"}, {"t": "Str", "c": "item"}]}]]}, {"t": "BlockQuote", "c": [{"t": "Para", "c": [{"t": "Str", "c": "A"}, {"t": "Space"}, {"t": "Str", "c": "quoted"}, {"t": "Space"}, {"t": "Str", "c": "line"}, {"t": "SoftBreak"}, {"t": "Str", "c": "that"}, {"t": "Space"}, {"t": "Str", "c": "wraps."}]}]}, {"t": "Table", "c": [[], [{"t": "AlignLeft"}, {"t": "AlignRight"}], [0, 0], [[{"t": "Plain", "c": [{"t": "Str", "c": "Name"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Qty"}]}]], [[[{"t": "Plain", "c": [{"t": "Str", "c": "Bolt"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "4"}]}]], [[{"t": "Plain", "c": [{"t": "Str", "c": "Nut"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "12"}]}]]]]}, {"t": "CodeBlock", "c": [["", ["js"], []], "const a = 1\nconsole.log(a)\n"]}, {"t": "HorizontalRule"}, {"t": "Para", "c": [{"t": "Str", "c": "Closing"}, {"t": "Space"}, {"t": "Str", "c": "line."}]}]

const lineBreak: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "line"}, {"t": "Space"}, {"t": "Str", "c": "one"}, {"t": "LineBreak"}, {"t": "Str", "c": "line"}, {"t": "Space"}, {"t": "Str", "c": "two"}]}]
const quoted: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "He"}, {"t": "Space"}, {"t": "Str", "c": "said"}, {"t": "Space"}, {"t": "Quoted", "c": [{"t": "DoubleQuote"}, [{"t": "Str", "c": "hello"}]]}, {"t": "Space"}, {"t": "Str", "c": "and"}, {"t": "Space"}, {"t": "Quoted", "c": [{"t": "SingleQuote"}, [{"t": "Str", "c": "bye"}]]}, {"t": "Str", "c": "."}]}]
const emptyHeader: PNode[] = [{"t": "Table", "c": [[], [{"t": "AlignDefault"}, {"t": "AlignDefault"}], [0, 0], [[], []], [[[{"t": "Plain", "c": [{"t": "Str", "c": "a"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "b"}]}]], [[{"t": "Plain", "c": [{"t": "Str", "c": "c"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "d"}]}]]]]}]
const mailLinks: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Mail"}, {"t": "Space"}, {"t": "Link", "c": [["", [], []], [{"t": "Str", "c": "me@example.com"}], ["mailto:me@example.com", ""]]}, {"t": "Space"}, {"t": "Str", "c": "or"}, {"t": "Space"}, {"t": "Link", "c": [["", [], []], [{"t": "Str", "c": "me@example.com"}], ["mailto:me@example.com", ""]]}, {"t": "Space"}, {"t": "Str", "c": "or"}, {"t": "Space"}, {"t": "Link", "c": [["", [], []], [{"t": "Str", "c": "jump"}], ["#top", ""]]}, {"t": "Str", "c": "."}]}]
const oneWord: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Hello"}]}]
const boldTwo: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Just"}, {"t": "Space"}, {"t": "Strong", "c": [{"t": "Str", "c": "one"}]}, {"t": "Space"}, {"t": "Str", "c": "word"}]}]
const definition: PNode[] = [{"t": "DefinitionList", "c": [[[{"t": "Str", "c": "Term"}], [[{"t": "Plain", "c": [{"t": "Str", "c": "First"}, {"t": "Space"}, {"t": "Str", "c": "meaning"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Second"}, {"t": "Space"}, {"t": "Str", "c": "meaning"}]}]]]]}]
const heading: PNode[] = [{"t": "Header", "c": [1, ["a-head", [], []], [{"t": "Str", "c": "A"}, {"t": "Space"}, {"t": "Str", "c": "head"}]]}]
const para: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Para"}, {"t": "Space"}, {"t": "Str", "c": "two"}, {"t": "Space"}, {"t": "Str", "c": "words"}, {"t": "Space"}, {"t": "Str", "c": "here."}]}]

const str = (c: string): PNode => ({ t: 'Str', c })
const plain = (...c: PNode[]): PNode => ({ t: 'Plain', c })

test('kitchen sink reply becomes clean plain text', () => {
  expect(kitchenSinkMarkdown.length > 0).toBe(true)
  expect(toPlain(kitchenSink)).toBe(
    [
      'Release notes',
      '',
      'This is bold, italic, inline code, struck text with a link (https://example.com/docs) and https://example.org here. Done \u{1F389}',
      '',
      '- Fruit',
      '  - Apple',
      '  - Pear',
      '- Vegetables',
      '',
      '3. Third step',
      '4. Fourth step',
      '',
      '- \u2610 Open item',
      '- \u2611 Done item',
      '',
      'A quoted line that wraps.',
      '',
      'Name\tQty',
      'Bolt\t4',
      'Nut\t12',
      '',
      'const a = 1',
      'console.log(a)',
      '',
      'Closing line.',
    ].join('\n'),
  )
})

test('no markdown symbols survive in the kitchen sink output', () => {
  const text = toPlain(kitchenSink)
  for (const symbol of ['**', '~~', '`', '#', '>', '|']) expect(text.includes(symbol)).toBe(false)
})

test('line breaks become newlines', () => {
  expect(toPlain(lineBreak)).toBe('line one\nline two')
})

test('quoted text gets curly quotes', () => {
  expect(toPlain(quoted)).toBe('He said \u201Chello\u201D and \u2018bye\u2019.')
})

test('a table with empty header cells skips the header row', () => {
  expect(toPlain(emptyHeader)).toBe('a\tb\nc\td')
})

test('an unknown table shape falls back to its text lines', () => {
  const odd: PNode = { t: 'Table', c: [{ weird: true }, [plain(str('first row'))], [[plain(str('second'), { t: 'Space' }, str('row'))]]] }
  expect(toPlain([odd])).toBe('first row\nsecond row')
})

test('a newer table shape still gives one tab-joined line per row', () => {
  const cell = (text: string) => [['', [], []], { t: 'AlignDefault' }, 1, 1, [plain(str(text))]]
  const row = (...texts: string[]) => [['', [], []], texts.map(cell)]
  const next: PNode = {
    t: 'Table',
    c: [['', [], []], [null, []], [], [['', [], []], [row('H1', 'H2')]], [[['', [], []], 0, [], [row('x', 'y')]]], [['', [], []], []]],
  }
  expect(toPlain([next])).toBe('H1\tH2\nx\ty')
})

test('mailto and in-page links show no url', () => {
  expect(toPlain(mailLinks)).toBe('Mail me@example.com or me@example.com or jump.')
})

test('a link whose text is empty shows its url', () => {
  const link: PNode = { t: 'Link', c: [['', [], []], [], ['https://example.com', '']] }
  expect(toPlain([plain(link)])).toBe('https://example.com')
})

test('definition lists indent each definition', () => {
  expect(toPlain(definition)).toBe('Term\n  First meaning\n  Second meaning')
})

test('horizontal rules and raw blocks are left out, and edges are trimmed', () => {
  const blocks: PNode[] = [{ t: 'HorizontalRule' }, { t: 'RawBlock', c: ['html', '<br>'] }, plain(str('kept  ')), { t: 'HorizontalRule' }]
  expect(toPlain(blocks)).toBe('kept')
})

test('a nested block inside a list item sits on the next line, indented', () => {
  const nested: PNode = {
    t: 'OrderedList',
    c: [[9, { t: 'DefaultStyle' }, { t: 'Period' }], [[plain(str('nine')), { t: 'CodeBlock', c: [['', [], []], 'x = 1\n'] }], [plain(str('ten'))]]],
  }
  expect(toPlain([nested])).toBe('9. nine\n   x = 1\n10. ten')
})

test('describeBlocks counts words in one paragraph-like block', () => {
  expect(describeBlocks(oneWord)).toBe('1 word')
  expect(describeBlocks(boldTwo)).toBe('3 words')
  expect(describeBlocks(heading)).toBe('2 words')
})

test('describeBlocks names one, two, three and four-plus kinds', () => {
  const code: PNode = { t: 'CodeBlock', c: [['', [], []], 'x'] }
  const list: PNode = { t: 'BulletList', c: [[plain(str('a'))]] }
  const table = kitchenSink.find((b) => b.t === 'Table') as PNode
  expect(describeBlocks([code])).toBe('a code block')
  expect(describeBlocks([...para, ...para])).toBe('2 paragraphs')
  expect(describeBlocks([...heading, ...para, ...para])).toBe('a heading and 2 paragraphs')
  expect(describeBlocks([...heading, ...para, ...para, list])).toBe('a heading, 2 paragraphs and a list')
  expect(describeBlocks([...heading, ...para, ...para, list, table])).toBe('a heading, 2 paragraphs, a list and more')
  expect(describeBlocks([...heading, ...para, ...para, list, table, code])).toBe('a heading, 2 paragraphs, a list and more')
})

test('describeBlocks counts a Div by its children and ignores uncountable blocks', () => {
  const div: PNode = { t: 'Div', c: [['', [], []], [...para, { t: 'BlockQuote', c: para }]] }
  expect(describeBlocks([div])).toBe('a paragraph and a quote')
  expect(describeBlocks([{ t: 'HorizontalRule' }])).toBe('some text')
})

test('the kitchen sink is described by its first three kinds', () => {
  expect(describeBlocks(kitchenSink)).toBe('a heading, 2 paragraphs, 3 lists and more')
})

test('an inline br becomes a newline in any case', () => {
  const brLower: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Wash"}, {"t": "Space"}, {"t": "Str", "c": "the"}, {"t": "Space"}, {"t": "Str", "c": "jars"}, {"t": "RawInline", "c": ["html", "<br>"]}, {"t": "Str", "c": "Dry"}, {"t": "Space"}, {"t": "Str", "c": "them"}, {"t": "Space"}, {"t": "Str", "c": "fully"}]}]
  const brUpper: PNode[] = [{"t": "Para", "c": [{"t": "Str", "c": "Wash"}, {"t": "RawInline", "c": ["html", "<BR/>"]}, {"t": "Str", "c": "Dry"}]}]
  expect(toPlain(brLower)).toBe('Wash the jars\nDry them fully')
  expect(toPlain(brUpper)).toBe('Wash\nDry')
})

test('other raw html stays out of the text', () => {
  const raw: PNode[] = [{ t: 'Para', c: [str('a'), { t: 'RawInline', c: ['html', '<b>'] }, str('b')] }]
  expect(toPlain(raw)).toBe('ab')
})

test('a br inside a table cell becomes a space', () => {
  const brCell: PNode[] = [{"t": "Table", "c": [[], [{"t": "AlignDefault"}, {"t": "AlignDefault"}], [0, 0], [[{"t": "Plain", "c": [{"t": "Str", "c": "A"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "B"}]}]], [[[{"t": "Plain", "c": [{"t": "Str", "c": "Wash"}, {"t": "RawInline", "c": ["html", "<br>"]}, {"t": "Str", "c": "Dry"}]}], [{"t": "Plain", "c": [{"t": "Str", "c": "x"}]}]]]]}]
  expect(toPlain(brCell)).toBe('A\tB\nWash Dry\tx')
})

test('an item that starts with a list prints no marker of its own', () => {
  const nested: PNode[] = [{"t": "BulletList", "c": [[{"t": "BulletList", "c": [[{"t": "Plain", "c": [{"t": "Str", "c": "Warm"}, {"t": "Space"}, {"t": "Str", "c": "jackets"}]}]]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Food"}]}]]}]
  expect(toPlain(nested)).toBe('  - Warm jackets\n- Food')
})

test('an ordered item that starts with a list prints no marker of its own', () => {
  const nested: PNode[] = [{"t": "OrderedList", "c": [[1, {"t": "DefaultStyle"}, {"t": "Period"}], [[{"t": "OrderedList", "c": [[1, {"t": "DefaultStyle"}, {"t": "Period"}], [[{"t": "Plain", "c": [{"t": "Str", "c": "Warm"}, {"t": "Space"}, {"t": "Str", "c": "jackets"}]}]]]}], [{"t": "Plain", "c": [{"t": "Str", "c": "Food"}]}]]]}]
  expect(toPlain(nested)).toBe('   1. Warm jackets\n2. Food')
})

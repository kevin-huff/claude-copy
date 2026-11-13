import { expect, test } from 'claude-code/testing'
import { styleHtml } from '../hooks/html'

const TABLE = `<table><thead><tr class="header"><th style="text-align: left;">Name</th><th style="text-align: right;">Qty</th><th style="text-align: center;">Note</th></tr></thead><tbody><tr class="odd"><td style="text-align: left;">Apple</td><td style="text-align: right;">3</td><td style="text-align: center;">ok</td></tr><tr class="even"><td style="text-align: left;">Pear</td><td style="text-align: right;">12</td><td style="text-align: center;">late</td></tr></tbody></table>`

const TASKS = `<ul class="task-list"><li><input type="checkbox" disabled="" />buy milk</li><li><input type="checkbox" disabled="" checked="" />write tests</li></ul>`

const QUOTE = `<blockquote><p>Quoted words here.</p></blockquote>`

const CODE = `<div class="sourceCode" id="cb1"><pre class="sourceCode js"><code class="sourceCode javascript"><span id="cb1-1"><a href="#cb1-1" aria-hidden="true"></a><span class="kw">const</span> a <span class="op">=</span> <span class="dv">1</span></span>
<span id="cb1-2"><a href="#cb1-2" aria-hidden="true"></a><span class="kw">const</span> b <span class="op">=</span> <span class="dv">2</span></span></code></pre></div>`

const PLAIN_CODE = `<pre><code>one
two</code></pre>`

const INLINE = `<p>A paragraph with <code>inline code</code>, <del>struck</del> text and <span class="emoji" data-emoji="smile">\u{1F604}</span> emoji.</p>`

const HEADING = `<h1 id="fruit-report">Fruit report</h1><p>Done.</p><hr />`

const opts = { tableBorders: true }

test('table gets collapsed borders, padded cells and a shaded bold header', () => {
  const out = styleHtml(TABLE, opts)
  expect(out).toContain('<table style="border-collapse:collapse">')
  expect(out).toContain(
    '<th style="text-align: left;padding:6px 12px;border:1px solid #d0d7de;background-color:#f0f2f5;font-weight:bold">Name</th>',
  )
  expect(out).toContain('<td style="text-align: right;padding:6px 12px;border:1px solid #d0d7de">3</td>')
  expect(out).toContain('<td style="text-align: center;padding:6px 12px;border:1px solid #d0d7de">ok</td>')
})

test('tableBorders false removes only the cell borders', () => {
  const on = styleHtml(TABLE, { tableBorders: true })
  const off = styleHtml(TABLE, { tableBorders: false })
  expect(off).not.toContain('border:1px')
  expect(off).toContain('border-collapse:collapse')
  expect(off).toContain('background-color:#f0f2f5')
  expect(off).toContain('text-align: right;')
  expect(on.split(';border:1px solid #d0d7de').join('')).toBe(off)
})

test('task list checkboxes become text and the list loses its bullets', () => {
  const out = styleHtml(TASKS, opts)
  expect(out).not.toContain('<input')
  expect(out).toContain('<ul class="task-list" style="list-style-type:none">')
  expect(out).toContain('<li>☐ buy milk</li>')
  expect(out).toContain('<li>☑ write tests</li>')
})

test('pandoc 3 style checkboxes with labels and paragraphs are handled', () => {
  const html =
    '<ul><li><label><input type="checkbox" />first</label></li><li><label><input type="checkbox" checked="checked" />second</label></li></ul>' +
    '<ul class="contains-task-list"><li class="task-list-item"><p><input type="checkbox" disabled checked />third</p></li></ul>'
  const out = styleHtml(html, opts)
  expect(out).not.toContain('<input')
  expect(out).not.toContain('label')
  expect(out).toContain('<ul style="list-style-type:none">')
  expect(out).toContain('<li>☐ first</li>')
  expect(out).toContain('<li>☑ second</li>')
  expect(out).toContain('<p>☑ third</p>')
})

test('a plain bullet list keeps its bullets', () => {
  const out = styleHtml('<ul><li>one</li><li>two</li></ul>', opts)
  expect(out).toBe('<ul><li>one</li><li>two</li></ul>')
})

test('blockquote gets a gray left bar and no color', () => {
  const out = styleHtml(QUOTE, opts)
  expect(out).toContain('<blockquote style="margin:8px 0;padding:0 0 0 14px;border-left:3px solid #9ca3af">')
  expect(out).not.toMatch(/blockquote[^>]*[^-]color:/)
})

test('code block loses anchors and ids and gets a boxed monospace pre', () => {
  const out = styleHtml(CODE, opts)
  expect(out).not.toContain('#cb')
  expect(out).not.toContain('<a ')
  expect(out).not.toMatch(/\sid="/)
  expect(out).toMatch(/<pre class="sourceCode js" style="[^"]*background-color:#f6f8fa[^"]*"/)
  expect(out).toMatch(/<pre[^>]*border:1px solid #d0d7de/)
  expect(out).toMatch(/<pre[^>]*white-space:pre-wrap/)
  expect(out).toMatch(/<pre[^>]*font-family:Consolas, 'Courier New', monospace/)
  expect(out).toContain('<span class="kw">const</span>')
  expect(out).toContain('<span class="op">=</span>')
})

test('code inside a pre gets only the font stack, no background', () => {
  const out = styleHtml(CODE, opts)
  const code = /<code[^>]*>/.exec(out)![0]
  expect(code).toContain("font-family:Consolas, 'Courier New', monospace")
  expect(code).not.toContain('background')
  expect(code).not.toContain('padding')
  const plain = /<code[^>]*>/.exec(styleHtml(PLAIN_CODE, opts))![0]
  expect(plain).toBe(`<code style="font-family:Consolas, 'Courier New', monospace">`)
})

test('inline code gets the font stack and a light background', () => {
  const out = styleHtml(INLINE, opts)
  expect(out).toMatch(/<code style="font-family:Consolas, 'Courier New', monospace;background-color:#f3f4f6[^"]*">inline code<\/code>/)
})

test('strikethrough, emoji and body text', () => {
  const out = styleHtml(INLINE, opts)
  expect(out).toContain('<del style="text-decoration:line-through">struck</del>')
  expect(out).not.toContain('class="emoji"')
  expect(out).not.toContain('data-emoji')
  expect(out).toContain('text and \u{1F604} emoji.')
  expect(out).toMatch(/^<p>/)
})

test('heading ids are dropped and hr gets a thin top border only', () => {
  const out = styleHtml(HEADING, opts)
  expect(out).toContain('<h1>Fruit report</h1>')
  expect(out).toMatch(/<hr style="border:none;border-top:1px solid #c8ccd0[^"]*" \/>/)
  expect(out).not.toMatch(/<hr[^>]*border:1px/)
})

test('no font or color lands on body text, links or headings', () => {
  const html = `<h2 id="x">Title</h2><p>See <a href="https://example.com/a" tabindex="-1">the page</a> now.</p><ul><li>item</li></ul>`
  const out = styleHtml(html, opts)
  expect(out).toBe('<h2>Title</h2><p>See <a href="https://example.com/a" tabindex="-1">the page</a> now.</p><ul><li>item</li></ul>')
})

test('pandoc 3 anchors with tabindex and colgroups are tolerated', () => {
  const html =
    '<div class="sourceCode" id="cb2"><pre class="sourceCode sh"><code class="sourceCode bash"><span id="cb2-1"><a href="#cb2-1" aria-hidden="true" tabindex="-1"></a>ls</span></code></pre></div>' +
    '<table class="data"><colgroup><col style="width: 50%" /><col style="width: 50%" /></colgroup><thead><tr class="header"><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
  const out = styleHtml(html, opts)
  expect(out).not.toContain('#cb')
  expect(out).not.toMatch(/\sid="/)
  expect(out).toContain('<table class="data" style="border-collapse:collapse">')
  expect(out).toContain('<colgroup><col style="width: 50%" />')
  expect(out).toContain('<td style="padding:6px 12px;border:1px solid #d0d7de">1</td>')
})

test('the whole document leaves no inputs, line anchors or ids', () => {
  const out = styleHtml([HEADING, INLINE, TABLE, TASKS, QUOTE, CODE].join(''), opts)
  expect(out).not.toContain('<input')
  expect(out).not.toContain('#cb')
  expect(out).not.toMatch(/\sid="/)
  expect(out).not.toMatch(/<p\s[^>]*style=/)
})

test('styling twice does not repeat rules', () => {
  const once = styleHtml(TABLE + CODE, opts)
  expect(styleHtml(once, opts)).toBe(once)
})

test('an item that starts with a nested bullet list loses its own marker', () => {
  const html = '<ul><li><ul><li>Warm jackets</li></ul></li><li>Food</li></ul>'
  const out = styleHtml(html, opts)
  expect(out).toContain('<li style="list-style-type:none"><ul><li>Warm jackets</li></ul></li>')
  expect(out).toContain('<li>Food</li>')
})

test('an item that starts with a nested numbered list loses its own marker', () => {
  const html = '<ol><li><ol><li>Run it</li></ol></li><li>Reboot</li></ol>'
  const out = styleHtml(html, opts)
  expect(out).toContain('<li style="list-style-type:none"><ol><li>Run it</li></ol></li>')
  expect(out).toContain('<li>Reboot</li>')
})

test('an item with text before its nested list keeps its marker', () => {
  const html = '<ul><li>Pack<ul><li>Boots</li></ul></li></ul>'
  expect(styleHtml(html, opts)).toBe(html)
})

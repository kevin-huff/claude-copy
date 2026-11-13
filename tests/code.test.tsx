import { expect, test } from 'claude-code/testing'
import { colorCode } from '../hooks/code'

const PY = "<div class=\"sourceCode\" id=\"cb1\"><pre class=\"sourceCode python\"><code class=\"sourceCode python\"><span id=\"cb1-1\"><a href=\"#cb1-1\" aria-hidden=\"true\"></a><span class=\"im\">import</span> os</span>\n<span id=\"cb1-2\"><a href=\"#cb1-2\" aria-hidden=\"true\"></a><span class=\"kw\">def</span> f(x):</span>\n<span id=\"cb1-3\"><a href=\"#cb1-3\" aria-hidden=\"true\"></a>    <span class=\"co\"># hi</span></span>\n<span id=\"cb1-4\"><a href=\"#cb1-4\" aria-hidden=\"true\"></a>    <span class=\"cf\">return</span> <span class=\"st\">&quot;a&quot;</span> <span class=\"op\">+</span> <span class=\"bu\">str</span>(<span class=\"fl\">1.5</span>) <span class=\"cf\">if</span> x <span class=\"cf\">else</span> <span class=\"va\">None</span></span></code></pre></div>"
const BASH = "<div class=\"sourceCode\" id=\"cb1\"><pre class=\"sourceCode bash\"><code class=\"sourceCode bash\"><span id=\"cb1-1\"><a href=\"#cb1-1\" aria-hidden=\"true\"></a><span class=\"bu\">echo</span> <span class=\"st\">&quot;hi&quot;</span> <span class=\"kw\">|</span> <span class=\"fu\">grep</span> -v foo <span class=\"co\"># c</span></span>\n<span id=\"cb1-2\"><a href=\"#cb1-2\" aria-hidden=\"true\"></a><span class=\"kw\">for</span> <span class=\"ex\">i</span> in 1 2<span class=\"kw\">;</span> <span class=\"kw\">do</span> <span class=\"fu\">ls</span> <span class=\"va\">$i</span><span class=\"kw\">;</span> <span class=\"kw\">done</span></span></code></pre></div>"
const EMOJI = "<p><span class=\"emoji\" data-emoji=\"smile\">😄</span> text</p>"

const TOKEN_CLASS = /<span class="(kw|dt|dv|bn|fl|ch|st|vs|ss|im|co|do|an|cv|in|ot|al|fu|er|wa|cn|sc|va|cf|op|bu|ex|pp|at)"/
const visible = (html: string) => html.replace(/<[^>]*>/g, '')

for (const [name, html] of [['python', PY], ['bash', BASH]] as const) {
  test(`on: ${name} tokens get colors and lose classes`, () => {
    const out = colorCode(html, true)
    expect(TOKEN_CLASS.test(out)).toBe(false)
    expect(out).toContain('<span style="color:#')
    expect(out).not.toContain('background')
    expect(visible(out)).toBe(visible(html))
  })

  test(`off: ${name} tokens are unwrapped`, () => {
    const out = colorCode(html, false)
    expect(TOKEN_CLASS.test(out)).toBe(false)
    expect(out).not.toContain('style=')
    expect(visible(out)).toBe(visible(html))
  })
}

test('python keyword, string and comment colors', () => {
  const out = colorCode(PY, true)
  expect(out).toContain('<span style="color:#cf222e">def</span>')
  expect(out).toContain('<span style="color:#6e7781;font-style:italic"># hi</span>')
  expect(out).toContain('<span style="color:#0a3069">&quot;a&quot;</span>')
})

test('id, bare and emoji spans are left alone', () => {
  const html = '<pre><code><span id="cb1-1">x <span class="kw">if</span></span><span>y</span></code></pre>'
  expect(colorCode(html, true)).toBe('<pre><code><span id="cb1-1">x <span style="color:#cf222e">if</span></span><span>y</span></code></pre>')
  expect(colorCode(html, false)).toBe('<pre><code><span id="cb1-1">x if</span><span>y</span></code></pre>')
  expect(colorCode(EMOJI, true)).toBe(EMOJI)
  expect(colorCode(EMOJI, false)).toBe(EMOJI)
})

test('html without code is unchanged', () => {
  const html = '<p>Hello <span class="kw">not code</span> <strong>there</strong></p>'
  expect(colorCode(html, true)).toBe(html)
  expect(colorCode(html, false)).toBe(html)
})

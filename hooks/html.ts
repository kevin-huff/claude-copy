const MONO = "Consolas, 'Courier New', monospace"
const BORDER = 'border:1px solid #d0d7de'

function addStyle(attrs: string, css: string): string {
  const found = /\sstyle="([^"]*)"/.exec(attrs)
  if (!found) return `${attrs} style="${css}"`
  const old = found[1]!.trim().replace(/;+\s*$/, '')
  if (css.split(';').every((part) => old.includes(part.split(':')[0]!))) return attrs
  const merged = old === '' ? css : `${old};${css}`
  return attrs.replace(found[0], ` style="${merged}"`)
}

function restyle(html: string, tag: string, css: string | ((attrs: string) => string | null)): string {
  const re = new RegExp(`<${tag}\\b([^>]*?)(\\s*/?)>`, 'g')
  return html.replace(re, (whole, attrs: string, tail: string) => {
    const rule = typeof css === 'string' ? css : css(attrs)
    return rule === null ? whole : `<${tag}${addStyle(attrs, rule)}${tail}>`
  })
}

function dropIds(html: string): string {
  return html.replace(/<[a-zA-Z][^>]*>/g, (tag) => tag.replace(/\s+id="[^"]*"/g, ''))
}

function dropLineAnchors(html: string): string {
  return html.replace(/<a\b[^>]*\bhref="#cb[^"]*"[^>]*>\s*<\/a>/g, '')
}

function unwrapEmoji(html: string): string {
  return html.replace(/<span\b[^>]*\bclass="[^"]*\bemoji\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g, '$1')
}

const CHECKBOX = /<input\b[^>]*type="checkbox"[^>]*>/

function styleTaskLists(html: string): string {
  const none = 'list-style-type:none'
  const lead = /^\s*<li\b[^>]*>\s*(?:<p\b[^>]*>\s*)?(?:<label\b[^>]*>\s*)?<input\b[^>]*type="checkbox"/
  const re = /<(ul|ol)\b([^>]*?)(\s*\/?)>/g
  const marked = html.replace(re, (whole, tag: string, attrs: string, tail: string, offset: number) => {
    const classed = /\bclass="[^"]*\btask-list\b[^"]*"/.test(attrs)
    const rest = html.slice(offset + whole.length)
    if (!classed && !lead.test(rest)) return whole
    return `<${tag}${addStyle(attrs, none)}${tail}>`
  })
  const boxes = marked.replace(/<\/?label\b[^>]*>/g, '').replace(new RegExp(CHECKBOX.source, 'g'), (box) =>
    /\schecked(?=[\s=/>])/.test(box) ? '☑ ' : '☐ ',
  )
  return boxes
}

function styleListOnlyItems(html: string): string {
  const re = /<li\b([^>]*?)(\s*\/?)>(?=\s*<(?:ul|ol)\b)/g
  return html.replace(re, (_whole, attrs: string, tail: string) => `<li${addStyle(attrs, 'list-style-type:none')}${tail}>`)
}

function styleOutsidePre(html: string, tableBorders: boolean): string {
  const border = tableBorders ? [BORDER] : []
  let out = html
  out = restyle(out, 'table', 'border-collapse:collapse')
  out = restyle(out, 'th', ['padding:6px 12px', ...border, 'background-color:#f0f2f5', 'font-weight:bold'].join(';'))
  out = restyle(out, 'td', ['padding:6px 12px', ...border].join(';'))
  out = restyle(out, 'blockquote', 'margin:8px 0;padding:0 0 0 14px;border-left:3px solid #9ca3af')
  out = restyle(out, 'hr', 'border:none;border-top:1px solid #c8ccd0;height:0;margin:12px 0')
  out = restyle(out, 'del', 'text-decoration:line-through')
  out = restyle(out, 'code', `font-family:${MONO};background-color:#f3f4f6;padding:1px 4px`)
  return out
}

function styleInsidePre(block: string): string {
  let out = restyle(
    block,
    'pre',
    `background-color:#f6f8fa;border:1px solid #d0d7de;padding:8px 12px;margin:8px 0;font-family:${MONO};white-space:pre-wrap`,
  )
  out = restyle(out, 'code', `font-family:${MONO}`)
  return out
}

export function styleHtml(html: string, opts: { tableBorders: boolean }): string {
  let out = dropLineAnchors(html)
  out = dropIds(out)
  out = unwrapEmoji(out)
  out = styleTaskLists(out)
  out = styleListOnlyItems(out)
  return out
    .split(/(<pre\b[\s\S]*?<\/pre>)/)
    .map((part, i) => (i % 2 === 1 ? styleInsidePre(part) : styleOutsidePre(part, opts.tableBorders)))
    .join('')
}

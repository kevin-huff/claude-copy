const STYLES: Record<string, string> = {
  kw: 'color:#cf222e',
  cf: 'color:#cf222e',
  dt: 'color:#953800',
  dv: 'color:#0550ae',
  bn: 'color:#0550ae',
  fl: 'color:#0550ae',
  ch: 'color:#0a3069',
  st: 'color:#0a3069',
  vs: 'color:#0a3069',
  ss: 'color:#0a3069',
  im: 'color:#cf222e',
  co: 'color:#6e7781;font-style:italic',
  do: 'color:#6e7781;font-style:italic',
  an: 'color:#6e7781;font-style:italic',
  cv: 'color:#6e7781;font-style:italic',
  in: 'color:#6e7781;font-style:italic',
  ot: 'color:#116329',
  al: 'color:#cf222e;font-weight:bold',
  er: 'color:#cf222e;font-weight:bold',
  wa: 'color:#cf222e;font-weight:bold',
  fu: 'color:#8250df',
  cn: 'color:#0550ae',
  sc: 'color:#0550ae',
  va: 'color:#953800',
  op: 'color:#cf222e',
  bu: 'color:#8250df',
  ex: 'color:#8250df',
  pp: 'color:#cf222e',
  at: 'color:#0550ae',
}

const CODE = /<code\b[^>]*>[\s\S]*?<\/code>/g
const TOKEN = /<span class="([a-z]{2})">([\s\S]*?)<\/span>/g

export function colorCode(html: string, on: boolean): string {
  return html.replace(CODE, (block) =>
    block.replace(TOKEN, (whole, name: string, inner: string) => {
      const style = STYLES[name]
      if (!style) return whole
      return on ? `<span style="${style}">${inner}</span>` : inner
    }),
  )
}

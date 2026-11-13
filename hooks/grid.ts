const BORDER = /^[─┌┐└┘├┤┬┴┼ ]+$/

function isBorder(line: string): boolean {
  const t = line.trim()
  return t.includes('─') && BORDER.test(t)
}

function barCount(line: string): number {
  let n = 0
  for (const ch of line) if (ch === '│') n++
  return n
}

function isRow(line: string): boolean {
  const t = line.trim()
  return t.length > 1 && t.startsWith('│') && t.endsWith('│') && barCount(t) >= 2
}

function unwrapRun(run: string[]): string[] | null {
  const rows = run.filter(isRow)
  if (rows.length === 0) return null
  const hasBorder = run.some(isBorder)
  if (!hasBorder) {
    const counts = rows.map(barCount)
    if (!counts.some((n, i) => counts.indexOf(n) !== i)) return null
  }
  const blocks: string[][] = [[]]
  for (const line of run) {
    if (isBorder(line)) blocks.push([])
    else blocks[blocks.length - 1]?.push(line)
  }
  const out: string[] = []
  for (const block of blocks) {
    if (block.length === 0) continue
    const split = block.map((line) => line.trim().split('│').slice(1, -1))
    const width = Math.max(...split.map((cells) => cells.length))
    const cols: string[] = []
    for (let i = 0; i < width; i++) {
      cols.push(
        split
          .map((cells) => (cells[i] ?? '').trim())
          .filter((cell) => cell !== '')
          .join(' '),
      )
    }
    out.push(cols.join(' | '))
  }
  return out
}

export function unwrapGrid(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let changed = false
  let i = 0
  const inGrid = (line: string | undefined) => line !== undefined && (isBorder(line) || isRow(line))
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (!inGrid(line)) {
      out.push(line)
      i++
      continue
    }
    let j = i
    while (j < lines.length && inGrid(lines[j])) j++
    const run = lines.slice(i, j)
    const unwrapped = unwrapRun(run)
    if (unwrapped) {
      out.push(...unwrapped)
      changed = true
    } else {
      out.push(...run)
    }
    i = j
  }
  return changed ? out.join('\n') : text
}

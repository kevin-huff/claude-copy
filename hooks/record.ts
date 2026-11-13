import type { EngineInterface } from 'claude-code'
import type { RunRecord, Timings } from '../types'

export async function recordPath($: EngineInterface): Promise<string | null> {
  const state = await $.env.get('XDG_STATE_HOME')
  if (state) return `${state}/claude-copy/last-run.json`
  const home = await $.env.get('HOME')
  if (home) return `${home}/.local/state/claude-copy/last-run.json`
  return null
}

export async function writeRecord($: EngineInterface, record: RunRecord): Promise<void> {
  try {
    const path = await recordPath($)
    if (!path) return
    await $.fs.write(path, JSON.stringify(record, null, 2))
  } catch {}
}

export async function readRecord($: EngineInterface): Promise<RunRecord | null> {
  try {
    const path = await recordPath($)
    if (!path) return null
    const text = await $.fs.read(path)
    if (typeof text !== 'string') return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as RunRecord) : null
  } catch {
    return null
  }
}

export async function modVersion($: EngineInterface): Promise<string> {
  try {
    const text = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    if (typeof text !== 'string') return ''
    const version = JSON.parse(text)?.version
    return typeof version === 'string' ? version : ''
  } catch {
    return ''
  }
}

export function stopwatch(): { lap(step: string): void; timings(): Timings } {
  const start = performance.now()
  let last = start
  const laps: Timings = {}
  return {
    lap(step) {
      const now = performance.now()
      laps[step] = (laps[step] ?? 0) + Math.round(now - last)
      last = now
    },
    timings() {
      return { ...laps, total: Math.round(performance.now() - start) }
    },
  }
}

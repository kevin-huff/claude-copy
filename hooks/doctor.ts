import type { EngineInterface } from 'claude-code'
import type { Check, Settings } from '../types'
import { BIND_SNIPPET, findBindings } from './keys'
import { findPowerShell, powershellVersion } from './clipboard'
import { pandocVersion } from './pandoc'
import { modVersion, readRecord } from './record'

const FULLSCREEN_FIX =
  'Add "tui": "fullscreen" to ~/.claude/settings.json (or set CLAUDE_CODE_NO_FLICKER=1), then start a new session'
const PANDOC_FIX = 'sudo apt install pandoc'
const POWERSHELL_FIX = 'Check that /mnt/c is mounted and WSL interop is on'
const PANDOC_OLD_FIX = 'Install a newer pandoc from https://github.com/jgm/pandoc/releases'
const BIND_FIX = `Add this to the bindings list in keybindings.json: ${BIND_SNIPPET}`

const onOff = (value: boolean) => (value ? 'on' : 'off')

async function checkPandoc($: EngineInterface): Promise<Check> {
  const name = 'pandoc'
  const ran = await pandocVersion($)
  if (!ran.ok) {
    return { name, ok: false, detail: ran.failure.kind === 'missing' ? 'not found' : ran.failure.detail, fix: PANDOC_FIX }
  }
  const [major = 0, minor = 0] = ran.value.split('.').map((n) => Number.parseInt(n, 10) || 0)
  if (major < 2 || (major === 2 && minor < 9)) {
    return { name, ok: false, detail: `version ${ran.value} is older than 2.9, the oldest tested`, fix: PANDOC_OLD_FIX }
  }
  return { name, ok: true, detail: `version ${ran.value}`, fix: null }
}

async function checkPowerShell($: EngineInterface): Promise<Check> {
  const name = 'Windows PowerShell'
  const path = await findPowerShell($)
  const ran = await powershellVersion($)
  if (!ran.ok) {
    return { name, ok: false, detail: `${ran.failure.detail} (${path})`, fix: POWERSHELL_FIX }
  }
  return { name, ok: true, detail: `version ${ran.value} at ${path}`, fix: null }
}

async function checkBinding($: EngineInterface): Promise<Check> {
  const name = 'Alt+C'
  const bindings = await findBindings($)
  const all = bindings?.filter((b) => b.action === 'command:rcopy') ?? []
  const rcopy = all.filter((b) => b.context === 'Chat')
  if (all.length > 0 && rcopy.length === 0) {
    const first = all[0]!
    return {
      name,
      ok: false,
      detail: `${first.key} runs /rcopy in the "${first.context}" context, but command keys only work in "Chat"`,
      fix: BIND_FIX,
    }
  }
  if (rcopy.length === 0) {
    return {
      name,
      ok: false,
      detail: bindings === null ? 'no readable keybindings.json' : 'no key runs /rcopy',
      fix: BIND_FIX,
    }
  }
  return { name, ok: true, detail: `${rcopy.map((b) => b.key).join(', ')} runs /rcopy`, fix: null }
}

async function checkLastCopy($: EngineInterface): Promise<Check> {
  const name = 'Last copy'
  const record = await readRecord($)
  if (!record) return { name, ok: true, detail: 'none yet', fix: null }
  const total = record.timings?.total
  const reason = record.reason ? ` (${record.reason})` : ''
  const time = typeof total === 'number' ? `, ${total} ms` : ''
  return { name, ok: true, detail: `${record.outcome}${reason}${time}`, fix: null }
}

export async function runDoctor($: EngineInterface, ctx: { isFullscreen: boolean; settings: Settings }): Promise<Check[]> {
  const { settings } = ctx
  const version = await modVersion($)
  const distro = await $.env.get('WSL_DISTRO_NAME')
  return [
    {
      name: 'Full-screen mode',
      ok: ctx.isFullscreen,
      detail: ctx.isFullscreen ? 'on' : 'off, so highlights can not be read',
      fix: ctx.isFullscreen ? null : FULLSCREEN_FIX,
    },
    distro
      ? { name: 'WSL', ok: true, detail: `distro ${distro}`, fix: null }
      : { name: 'WSL', ok: false, detail: 'not running inside WSL', fix: 'claude-copy works on Windows through WSL only, for now' },
    await checkPandoc($),
    await checkPowerShell($),
    await checkBinding($),
    {
      name: 'claude-copy',
      ok: true,
      detail: `version ${version || 'unknown'}, default copy ${settings.defaultVariant}, table borders ${onOff(settings.tableBorders)}, code colors ${onOff(settings.codeColors)}`,
      fix: null,
    },
    await checkLastCopy($),
  ]
}

export function doctorLines(checks: readonly Check[]): string[] {
  return checks.map((c) => (c.ok ? `✓ ${c.name}: ${c.detail}` : `✗ ${c.name}: ${c.detail}. Fix: ${c.fix ?? 'none known'}`))
}

export function doctorToast(checks: readonly Check[]): string {
  const bad = checks.filter((c) => !c.ok).length
  if (bad === 0) return `claude-copy doctor: all ${checks.length} checks passed`
  return `claude-copy doctor: ${bad} ${bad === 1 ? 'problem' : 'problems'}, fixes are in the transcript`
}

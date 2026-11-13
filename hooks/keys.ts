import type { EngineInterface } from 'claude-code'
import type { Binding, Settings } from '../types'

export const BIND_SNIPPET = '{ "context": "Chat", "bindings": { "alt+c": "command:rcopy" } }'

export const BIND_HINT =
  'claude-copy: to copy with Alt+C, add "alt+c": "command:rcopy" to a "Chat" block in the bindings list of keybindings.json in your Claude config folder (~/.claude). It works without a restart. /rcopy help has more.'

async function keybindingsPath($: EngineInterface): Promise<string | null> {
  const dir = await $.env.get('CLAUDE_CONFIG_DIR')
  if (dir) return `${dir}/keybindings.json`
  const home = await $.env.get('HOME')
  return home ? `${home}/.claude/keybindings.json` : null
}

export async function findBindings($: EngineInterface): Promise<Binding[] | null> {
  try {
    const path = await keybindingsPath($)
    if (!path) return null
    const text = await $.fs.read(path)
    if (typeof text !== 'string') return null
    const parsed = JSON.parse(text)
    const found: Binding[] = []
    const blocks = Array.isArray(parsed?.bindings) ? parsed.bindings : []
    for (const block of blocks) {
      const map = block?.bindings
      if (!map || typeof map !== 'object') continue
      for (const [key, action] of Object.entries(map)) {
        if (typeof action === 'string' && action.startsWith('command:rcopy')) {
          found.push({ context: String(block.context ?? ''), key, action })
        }
      }
    }
    return found
  } catch {
    return null
  }
}

export async function maybeHint($: EngineInterface): Promise<boolean> {
  try {
    if (await $.store.get('bindHintShown')) return false
    const bindings = await findBindings($)
    if (bindings?.some((b) => b.action === 'command:rcopy' && b.context === 'Chat')) {
      await $.store.set('bindHintShown', true)
      return false
    }
    $.ui.log(BIND_HINT)
    await $.store.set('bindHintShown', true)
    return true
  } catch {
    return false
  }
}

const onOff = (value: boolean) => (value ? 'on' : 'off')

export function helpLines(settings: Settings, bindings: Binding[] | null): string[] {
  const keys = (bindings ?? []).filter((b) => b.context === 'Chat' && (b.action === 'command:rcopy' || b.action === 'command:rcopy-md'))
  const keyLine = keys.length
    ? `Keys: ${keys.map((b) => `${b.key} runs /${b.action.slice('command:'.length)}`).join(', ')}`
    : `No key is bound yet. Add this to the bindings list in keybindings.json: ${BIND_SNIPPET}`
  return [
    'claude-copy: copy Claude replies with their formatting',
    'Highlight text, then press Alt+C or run /rcopy. With nothing highlighted, /rcopy copies the last reply.',
    '/rcopy N copies the whole Nth-last reply (1 is the last). A highlight is ignored when N is given.',
    '/rcopy md, /rcopy plain and /rcopy html copy Markdown, plain text or HTML source. /rcopy rich copies formatted text plus plain text.',
    '/rcopy-md copies the highlight or the last reply as Markdown, and takes an optional N. Use it for a second key.',
    '/rcopy doctor checks pandoc, Windows PowerShell, full-screen mode and the key binding.',
    keyLine,
    `/config has the rcopy settings. Now: default copy ${settings.defaultVariant}, table borders ${onOff(settings.tableBorders)}, code colors ${onOff(settings.codeColors)}.`,
  ]
}

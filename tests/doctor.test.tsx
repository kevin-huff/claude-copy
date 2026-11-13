import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import type { Binding, Settings } from '../types'
import { clearPowerShellPath, WINDOWS_POWERSHELL } from '../hooks/clipboard'
import { clearTreeCache } from '../hooks/pandoc'
import { doctorLines, doctorToast, runDoctor } from '../hooks/doctor'
import { BIND_HINT, findBindings, helpLines, maybeHint } from '../hooks/keys'

const settings: Settings = { defaultVariant: 'rich', tableBorders: true, codeColors: false }

const bindingsFile = (action: string | null) =>
  JSON.stringify({
    $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
    bindings: [
      { context: 'Global', bindings: { 'ctrl+x': 'app:exit' } },
      { context: 'Chat', bindings: action ? { 'alt+c': action, 'alt+m': 'command:rcopy-md' } : {} },
    ],
  })

type Fake = {
  files?: Record<string, string>
  env?: Record<string, string>
  pandoc?: string | Error
  powershell?: string | Error
  psExists?: boolean
}

function fake(opts: Fake = {}) {
  const logs: string[] = []
  const stored: Record<string, unknown> = {}
  const files = opts.files ?? {}
  const env: Record<string, string> = { HOME: '/home/tester', WSL_DISTRO_NAME: 'Ubuntu', ...(opts.env ?? {}) }
  const $ = {
    env: { get: async (name: string) => env[name] },
    fs: {
      exists: async (path: string) => (path === WINDOWS_POWERSHELL ? opts.psExists !== false : path in files),
      read: async (path: string) => {
        if (!(path in files)) throw new Error('ENOENT')
        return files[path]
      },
    },
    plugin: { root: '/plugins/claude-copy' },
    store: {
      get: async (key: string) => stored[key],
      set: async (key: string, value: unknown) => {
        stored[key] = value
      },
    },
    ui: { log: (text: string) => logs.push(text) },
    process: {
      run: async (argv: string[]) => {
        const answer = argv[0] === 'pandoc' ? (opts.pandoc ?? 'pandoc 2.9.2.1\nCompiled with pandoc-types 1.20\n') : (opts.powershell ?? '5.1.19041.1\r\n')
        if (answer instanceof Error) throw answer
        return { exitCode: 0, stdout: answer, stderr: '' }
      },
    },
  } as unknown as EngineInterface
  return { $, logs, stored }
}

const KEYS = '/home/tester/.claude/keybindings.json'
const COMMANDS = { [KEYS]: bindingsFile('command:rcopy') }

const reset = () => {
  clearTreeCache()
  clearPowerShellPath()
}

test('doctor passes when everything is in place', async () => {
  reset()
  const { $ } = fake({
    files: {
      ...COMMANDS,
      '/plugins/claude-copy/.claude-plugin/plugin.json': '{"version":"0.1.0"}',
      '/home/tester/.local/state/claude-copy/last-run.json': JSON.stringify({ outcome: 'formatted', reason: null, timings: { total: 212 } }),
    },
  })
  const checks = await runDoctor($, { isFullscreen: true, settings })
  expect(checks.map((c) => c.name)).toEqual(['Full-screen mode', 'WSL', 'pandoc', 'Windows PowerShell', 'Alt+C', 'claude-copy', 'Last copy'])
  expect(checks.every((c) => c.ok && c.fix === null)).toBe(true)
  expect(checks[2]!.detail).toBe('version 2.9.2.1')
  expect(checks[3]!.detail).toBe(`version 5.1.19041.1 at ${WINDOWS_POWERSHELL}`)
  expect(checks[4]!.detail).toBe('alt+c runs /rcopy')
  expect(checks[5]!.detail).toBe('version 0.1.0, default copy rich, table borders on, code colors off')
  expect(checks[6]!.detail).toBe('formatted, 212 ms')
  expect(doctorToast(checks)).toBe('claude-copy doctor: all 7 checks passed')
  expect(doctorLines(checks)[2]).toBe('✓ pandoc: version 2.9.2.1')
})

test('doctor names a fix for pandoc and PowerShell when both are missing', async () => {
  reset()
  const { $ } = fake({
    files: COMMANDS,
    pandoc: new Error('spawn pandoc ENOENT'),
    powershell: new Error('spawn powershell.exe ENOENT'),
    psExists: false,
  })
  const checks = await runDoctor($, { isFullscreen: true, settings })
  const pandoc = checks[2]!
  const ps = checks[3]!
  expect(pandoc.ok).toBe(false)
  expect(pandoc.fix).toBe('sudo apt install pandoc')
  expect(ps.ok).toBe(false)
  expect(ps.detail).toContain('powershell.exe')
  expect(ps.fix).toBe('Check that /mnt/c is mounted and WSL interop is on')
  expect(doctorToast(checks)).toBe('claude-copy doctor: 2 problems, fixes are in the transcript')
  expect(doctorLines(checks)[2]).toBe('✗ pandoc: not found. Fix: sudo apt install pandoc')
})

test('doctor fails a pandoc older than major version 2', async () => {
  reset()
  const { $ } = fake({ files: COMMANDS, pandoc: 'pandoc 1.19.2.4\n' })
  const checks = await runDoctor($, { isFullscreen: true, settings })
  expect(checks[2]!.ok).toBe(false)
  expect(checks[2]!.detail).toContain('1.19.2.4')
  expect(checks[2]!.detail).toBe('version 1.19.2.4 is older than 2.9, the oldest tested')
  expect(checks[2]!.fix).toContain('https://github.com/jgm/pandoc/releases')
})

test('doctor fails pandoc 2.5, passes 2.9.2.1 and 3.1', async () => {
  reset()
  const old = await runDoctor(fake({ files: COMMANDS, pandoc: 'pandoc 2.5\n' }).$, { isFullscreen: true, settings })
  expect(old[2]!.ok).toBe(false)
  expect(old[2]!.detail).toBe('version 2.5 is older than 2.9, the oldest tested')
  expect(old[2]!.fix).toContain('https://github.com/jgm/pandoc/releases')
  for (const v of ['2.9.2.1', '3.1']) {
    reset()
    const ok = await runDoctor(fake({ files: COMMANDS, pandoc: `pandoc ${v}\n` }).$, { isFullscreen: true, settings })
    expect(ok[2]!.ok).toBe(true)
  }
})

const GLOBAL_ONLY = JSON.stringify({
  bindings: [{ context: 'Global', bindings: { 'alt+c': 'command:rcopy' } }],
})

test('a binding only in the Global context fails doctor and still shows the hint', async () => {
  reset()
  const { $, logs } = fake({ files: { [KEYS]: GLOBAL_ONLY } })
  const checks = await runDoctor($, { isFullscreen: true, settings })
  expect(checks[4]!.ok).toBe(false)
  expect(checks[4]!.detail).toBe('alt+c runs /rcopy in the "Global" context, but command keys only work in "Chat"')
  expect(await maybeHint($)).toBe(true)
  expect(logs).toEqual([BIND_HINT])
})

test('Chat plus Global bindings pass doctor', async () => {
  reset()
  const file = JSON.stringify({
    bindings: [
      { context: 'Global', bindings: { 'alt+g': 'command:rcopy' } },
      { context: 'Chat', bindings: { 'alt+c': 'command:rcopy' } },
    ],
  })
  const checks = await runDoctor(fake({ files: { [KEYS]: file } }).$, { isFullscreen: true, settings })
  expect(checks[4]!.ok).toBe(true)
  expect(checks[4]!.detail).toBe('alt+c runs /rcopy')
})

test('helpLines ignores non-Chat bindings and describes rich copies', () => {
  const text = helpLines(settings, [
    { context: 'Global', key: 'alt+g', action: 'command:rcopy' },
    { context: 'Chat', key: 'alt+c', action: 'command:rcopy' },
  ]).join('\n')
  expect(text).toContain('Keys: alt+c runs /rcopy')
  expect(text).not.toContain('alt+g')
  expect(text).toContain('copies formatted text plus plain text')
  expect(text).not.toContain('default look')
})

test('doctor flags a session that is not full screen and a missing WSL', async () => {
  reset()
  const { $ } = fake({ files: COMMANDS, env: { WSL_DISTRO_NAME: '' } })
  const checks = await runDoctor($, { isFullscreen: false, settings })
  expect(checks[0]!.ok).toBe(false)
  expect(checks[0]!.fix).toBe(
    'Add "tui": "fullscreen" to ~/.claude/settings.json (or set CLAUDE_CODE_NO_FLICKER=1), then start a new session',
  )
  expect(checks[1]!.ok).toBe(false)
  expect(checks[1]!.fix).toBe('claude-copy works on Windows through WSL only, for now')
  expect(doctorToast(checks)).toBe('claude-copy doctor: 2 problems, fixes are in the transcript')
})

test('doctor toast says problem in the singular for one failure', async () => {
  reset()
  const { $ } = fake({ files: COMMANDS })
  const checks = await runDoctor($, { isFullscreen: false, settings })
  expect(doctorToast(checks)).toBe('claude-copy doctor: 1 problem, fixes are in the transcript')
})

test('doctor reports the Alt+C binding as missing when the file is absent or unbound', async () => {
  reset()
  const missing = await runDoctor(fake().$, { isFullscreen: true, settings })
  expect(missing[4]!.ok).toBe(false)
  expect(missing[4]!.detail).toBe('no readable keybindings.json')
  expect(missing[4]!.fix).toContain('"alt+c": "command:rcopy"')
  expect(missing[6]!.detail).toBe('none yet')
  reset()
  const unbound = await runDoctor(fake({ files: { [KEYS]: bindingsFile(null) } }).$, { isFullscreen: true, settings })
  expect(unbound[4]!.ok).toBe(false)
  expect(unbound[4]!.detail).toBe('no key runs /rcopy')
})

test('findBindings honors CLAUDE_CONFIG_DIR and returns null for missing or broken files', async () => {
  const custom = fake({ env: { CLAUDE_CONFIG_DIR: '/cfg' }, files: { '/cfg/keybindings.json': bindingsFile('command:rcopy') } })
  const found = (await findBindings(custom.$)) as Binding[]
  expect(found).toEqual([
    { context: 'Chat', key: 'alt+c', action: 'command:rcopy' },
    { context: 'Chat', key: 'alt+m', action: 'command:rcopy-md' },
  ])
  expect(await findBindings(fake().$)).toBe(null)
  expect(await findBindings(fake({ files: { [KEYS]: '{ not json' } }).$)).toBe(null)
  expect(await findBindings(fake({ env: { HOME: '' } }).$)).toBe(null)
  expect(await findBindings(fake({ files: { [KEYS]: '[]' } }).$)).toEqual([])
})

test('maybeHint logs the hint once over two calls', async () => {
  const { $, logs, stored } = fake({ files: { [KEYS]: bindingsFile(null) } })
  expect(await maybeHint($)).toBe(true)
  expect(await maybeHint($)).toBe(false)
  expect(logs).toEqual([BIND_HINT])
  expect(stored.bindHintShown).toBe(true)
  expect(BIND_HINT).toContain('alt+c')
  expect(BIND_HINT).toContain('command:rcopy')
  expect(BIND_HINT).toContain('Chat')
  expect(BIND_HINT).toContain('/rcopy help')
  expect(BIND_HINT).not.toContain('\n')
})

test('maybeHint hints when keybindings.json is missing', async () => {
  const { $, logs } = fake()
  expect(await maybeHint($)).toBe(true)
  expect(logs.length).toBe(1)
})

test('maybeHint stays quiet when alt+c is bound and remembers it', async () => {
  const { $, logs, stored } = fake({ files: COMMANDS })
  expect(await maybeHint($)).toBe(false)
  expect(logs).toEqual([])
  expect(stored.bindHintShown).toBe(true)
})

test('helpLines lists usage, variants, doctor and settings with a binding', () => {
  const bindings: Binding[] = [
    { context: 'Chat', key: 'alt+c', action: 'command:rcopy' },
    { context: 'Chat', key: 'alt+m', action: 'command:rcopy-md' },
  ]
  const text = helpLines(settings, bindings).join('\n')
  expect(text).toContain('Alt+C')
  expect(text).toContain('last reply')
  expect(text).toContain('/rcopy N')
  expect(text).toContain('/rcopy md')
  expect(text).toContain('plain')
  expect(text).toContain('html')
  expect(text).toContain('/rcopy-md')
  expect(text).toContain('/rcopy doctor')
  expect(text).toContain('Keys: alt+c runs /rcopy, alt+m runs /rcopy-md')
  expect(text).toContain('/config')
  expect(text).toContain('default copy rich, table borders on, code colors off')
  expect(text).not.toContain('—')
})

test('helpLines shows the binding snippet when nothing is bound', () => {
  for (const bindings of [null, [] as Binding[]]) {
    const text = helpLines({ defaultVariant: 'md', tableBorders: false, codeColors: true }, bindings).join('\n')
    expect(text).toContain('No key is bound yet')
    expect(text).toContain('"alt+c": "command:rcopy"')
    expect(text).toContain('default copy md, table borders off, code colors on')
  }
})

test('doctor lines mark failures with their fix and use no em dash', async () => {
  reset()
  const { $ } = fake({ pandoc: new Error('spawn pandoc ENOENT') })
  const lines = doctorLines(await runDoctor($, { isFullscreen: false, settings }))
  expect(lines.length).toBe(7)
  expect(lines.filter((l) => l.startsWith('✗')).length).toBe(3)
  expect(lines.join('\n')).not.toContain('—')
})

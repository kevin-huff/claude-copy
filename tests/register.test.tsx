import { expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'
import { clearPowerShellPath, WINDOWS_POWERSHELL } from '../hooks/clipboard'
import { clearTreeCache } from '../hooks/pandoc'
import { CASES } from './fixtures/match'
import { GFM_OUT, HTML_OUT, LATEST, OLDER, TREES, decodeStdin } from './fixtures/session'

type On = Parameters<TestBody>[1]

const result = (stdout: string, exitCode = 0, stderr = '') => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

const conversation = (replies: readonly string[]): SessionMessage[] =>
  replies.flatMap((md, i): SessionMessage[] => [
    { role: 'user', text: `Invented question ${i + 1}`, toolUses: [] },
    { role: 'assistant', text: md, toolUses: [] },
  ])

type World = {
  toasts: string[]
  logs: string[]
  copies: string[]
  writes: Record<string, string>
  powershell: { argv: readonly string[]; stdin: string | undefined }[]
  pandoc: string[]
}

type Setup = {
  replies?: string[]
  selection?: { text: string; requestId?: string }
  keybindings?: string
  messagesThrow?: string
  commands?: unknown[]
}

function world(on: On, setup: Setup = {}): World {
  clearTreeCache()
  clearPowerShellPath()
  const w: World = { toasts: [], logs: [], copies: [], writes: {}, powershell: [], pandoc: [] }
  mock.env(on, { HOME: '/home/tester', WSL_DISTRO_NAME: 'Ubuntu' })
  mock.store(on)
  on('command.register', (_, e) => {
    setup.commands?.push(e)
    return { value: { command: e.name } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.messages', () => {
    if (setup.messagesThrow) throw new Error(setup.messagesThrow)
    return { value: conversation(setup.replies ?? [OLDER, LATEST]) }
  })
  on('ui.selection', () => ({ value: setup.selection }))
  on('ui.toast', (_, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', (_, e) => {
    w.logs.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    w.copies.push(e.text)
    return { value: { isCopied: true } }
  })
  on('fs.exists', (_, e) => ({ value: e.path === WINDOWS_POWERSHELL }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.claude-plugin/plugin.json')) return { value: JSON.stringify({ name: 'claude-copy', version: '0.1.0' }) }
    if (e.path === '/home/tester/.claude/keybindings.json' && setup.keybindings !== undefined) return { value: setup.keybindings }
    throw new Error(`ENOENT: ${e.path}`)
  })
  on('fs.write', (_, e) => {
    w.writes[e.path] = e.text
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    const stdin = typeof e.init?.stdin === 'string' ? e.init.stdin : undefined
    if (e.argv[0] === 'pandoc') {
      w.pandoc.push(e.argv.join(' '))
      if (e.argv.includes('--version')) return result('pandoc 2.9.2.1\n')
      const to = e.argv[e.argv.indexOf('-t') + 1]
      if (to === 'json') {
        const doc = TREES[stdin ?? '']
        return doc ? result(JSON.stringify(doc)) : result('', 64, 'no fixture')
      }
      return result(to?.startsWith('gfm') ? GFM_OUT : HTML_OUT)
    }
    w.powershell.push({ argv: e.argv, stdin })
    return result('5.1.19041\n')
  })
  return w
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

const run = ($: Engine, command: string, args = '', isFullscreen = true) =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen, columns: 120 } })

test('both commands are registered with their hints and run mid-turn', async ($, on) => {
  const specs: unknown[] = []
  world(on, { commands: specs })
  await start($)
  expect(specs).toEqual([
    {
      name: 'rcopy',
      description: 'Copy the highlighted part of a Claude reply, or the last reply, with formatting',
      argumentHint: '[N] [md|plain|html] | help | doctor',
      immediate: true,
    },
    { name: 'rcopy-md', description: 'Copy the highlight or the last reply as Markdown', argumentHint: '[N]', immediate: true },
  ])
})

test('/rcopy help logs the help lines and copies nothing', async ($, on) => {
  const w = world(on)
  await start($)
  const out = await run($, 'rcopy', 'help')
  expect(out).toEqual({})
  expect(w.logs.length).toBeGreaterThan(3)
  expect(w.logs.join('\n')).toContain('/rcopy doctor')
  expect(w.toasts).toEqual([])
  expect(w.copies).toEqual([])
  expect(w.powershell).toEqual([])
  expect(w.pandoc).toEqual([])
})

test('/rcopy doctor logs one line per check and toasts once', async ($, on) => {
  const w = world(on)
  await start($)
  const out = await run($, 'rcopy', 'doctor')
  expect(out).toEqual({})
  expect(w.logs.length).toBe(7)
  expect(w.logs.some((l) => l.includes('pandoc: version 2.9.2.1'))).toBe(true)
  expect(w.logs.some((l) => l.startsWith('✗ Alt+C'))).toBe(true)
  expect(w.toasts).toEqual(['claude-copy doctor: 1 problem, fixes are in the transcript'])
  expect(w.copies).toEqual([])
})

test('/rcopy doctor names the full-screen fix when full-screen is off', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy', 'doctor', false)
  expect(w.logs.some((l) => l.startsWith('✗ Full-screen mode') && l.includes('"tui": "fullscreen"'))).toBe(true)
  expect(w.toasts.length).toBe(1)
})

test('/rcopy bogus toasts the unknown option and copies nothing', async ($, on) => {
  const w = world(on)
  await start($)
  const out = await run($, 'rcopy', 'bogus')
  expect(out).toEqual({})
  expect(w.toasts).toEqual(['Unknown option "bogus". Try /rcopy help'])
  expect(w.powershell).toEqual([])
  expect(w.copies).toEqual([])
})

test('a long bad word is cut to 30 characters', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy', 'x'.repeat(50))
  expect(w.toasts).toEqual([`Unknown option "${'x'.repeat(30)}". Try /rcopy help`])
})

test('/rcopy over a highlight writes through PowerShell with one toast', async ($, on) => {
  const c = CASES[0]!
  const w = world(on, { replies: [OLDER, c.markdown], selection: { text: c.highlight } })
  await start($)
  const out = await run($, 'rcopy')
  expect(out).toEqual({})
  expect(w.toasts.length).toBe(1)
  expect(w.toasts[0]).toMatch(/^Copied .* with formatting$/)
  expect(w.copies).toEqual([])
  expect(w.powershell.length).toBe(1)
  expect(w.powershell[0]!.argv[0]).toBe(WINDOWS_POWERSHELL)
  const sent = decodeStdin(w.powershell[0]!.stdin)
  expect(sent.payload).toContain('Version:0.9')
  expect(sent.text).toContain('Tomatoes go along the south fence')
  const record = JSON.parse(w.writes['/home/tester/.local/state/claude-copy/last-run.json']!)
  expect(record.outcome).toBe('formatted')
  expect(record.command).toBe('/rcopy')
})

test('/rcopy with nothing highlighted copies the last reply', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy')
  expect(w.toasts).toEqual(['Copied the last reply with formatting'])
  expect(w.powershell.length).toBe(1)
})

test('defaultVariant plain makes /rcopy copy through ui.copy', { options: { defaultVariant: 'plain' } }, async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy')
  expect(w.toasts).toEqual(['Copied the last reply as plain text'])
  expect(w.copies).toEqual(['Here is bold and a list:\n\n- one\n- two'])
  expect(w.powershell).toEqual([])
})

test('a variant word beats the default and N picks an older reply', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy', '2 md')
  expect(w.copies).toEqual([OLDER])
  expect(w.toasts).toEqual(['Copied the 2nd-last reply as Markdown'])
})

test('/rcopy-md copies the last reply as Markdown', async ($, on) => {
  const w = world(on)
  await start($)
  const out = await run($, 'rcopy-md')
  expect(out).toEqual({})
  expect(w.copies).toEqual([LATEST])
  expect(w.toasts).toEqual(['Copied the last reply as Markdown'])
  expect(w.pandoc).toEqual([])
})

test('/rcopy-md takes an optional N and nothing else', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy-md', '2')
  expect(w.copies).toEqual([OLDER])
  await run($, 'rcopy-md', 'plain')
  await run($, 'rcopy-md', '0')
  await run($, 'rcopy-md', '1 2')
  expect(w.toasts.slice(1)).toEqual([
    'Unknown option "plain". Try /rcopy help',
    'Unknown option "0". Try /rcopy help',
    'Unknown option "2". Try /rcopy help',
  ])
  expect(w.copies.length).toBe(1)
})

test('the Alt+C hint logs once over two runs when no keybindings file exists', async ($, on) => {
  const w = world(on)
  await start($)
  await run($, 'rcopy')
  await run($, 'rcopy')
  const hints = w.logs.filter((l) => l.includes('alt+c'))
  expect(hints.length).toBe(1)
  expect(w.toasts.length).toBe(2)
})

test('no hint appears when keybindings.json already binds /rcopy', async ($, on) => {
  const keybindings = JSON.stringify({ bindings: [{ context: 'Chat', bindings: { 'alt+c': 'command:rcopy' } }] })
  const w = world(on, { keybindings })
  await start($)
  await run($, 'rcopy')
  expect(w.logs).toEqual([])
  expect(w.toasts.length).toBe(1)
})

test('a failure inside a handler becomes one error toast and still returns {}', async ($, on) => {
  const w = world(on, { messagesThrow: 'x'.repeat(100) })
  await start($)
  const out = await run($, 'rcopy')
  expect(out).toEqual({})
  expect(w.toasts.length).toBe(1)
  expect(w.toasts[0]!.length).toBeLessThan(100)
})

test('a copy while a turn is running tells a missed highlight to retry', async ($, on) => {
  const w = world(on, { selection: { text: 'text that is nowhere in any reply of this chat' } })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.start({ text: 'side job', turnId: 't2', agentId: 'a1' })
  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't2' } as never)
  await run($, 'rcopy')
  expect(w.toasts.length).toBe(1)
  expect(w.toasts[0]).toContain('Try again when Claude finishes')
  await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' } as never)
  await run($, 'rcopy')
  expect(w.toasts[1]).not.toContain('Try again when Claude finishes')
})

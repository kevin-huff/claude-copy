import { expect, test } from 'claude-code/testing'
import type { EngineInterface, ProcessRunInit } from 'claude-code'
import { WINDOWS_POWERSHELL, cfHtml, clearPowerShellPath, findPowerShell, powershellVersion, writeRich, writeText } from '../hooks/clipboard'

type Call = { argv: readonly string[]; init?: ProcessRunInit }

type Fake = {
  exists?: boolean
  copied?: boolean
  copyThrows?: boolean
  run?: (argv: readonly string[], init?: ProcessRunInit) => Promise<{ exitCode: number; stdout: string; stderr: string }>
}

function fake(opts: Fake = {}) {
  const calls: Call[] = []
  const copies: string[] = []
  const exists: string[] = []
  const $ = {
    fs: {
      exists: async (path: string) => {
        exists.push(path)
        return opts.exists ?? true
      },
    },
    ui: {
      copy: async (args: { text: string }) => {
        copies.push(args.text)
        if (opts.copyThrows) throw new Error('no clipboard')
        return opts.copied ? { isCopied: true } : { isCopied: false, reason: 'no surface' }
      },
    },
    process: {
      run: async (argv: readonly string[], init?: ProcessRunInit) => {
        calls.push({ argv, init })
        return opts.run ? opts.run(argv, init) : { exitCode: 0, stdout: '', stderr: '' }
      },
    },
  } as unknown as EngineInterface
  return { $, calls, copies, exists }
}

const bytes = new TextEncoder()
const decodeB64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
const decodeUtf16 = (b64: string) => {
  const raw = atob(b64)
  let out = ''
  for (let i = 0; i < raw.length; i += 2) out += String.fromCharCode(raw.charCodeAt(i) | (raw.charCodeAt(i + 1) << 8))
  return out
}

test('cfHtml offsets are exact UTF-8 byte offsets', () => {
  clearPowerShellPath()
  const fragment = '<p>It’s “quoted” — done \u{1F600}</p>'
  const payload = cfHtml(fragment)
  const lines = payload.split('\r\n')
  expect(lines[0]).toBe('Version:0.9')
  const num = (line: string) => {
    const [, value] = line.split(':')
    expect(value).toHaveLength(10)
    return Number(value)
  }
  const startHtml = num(lines[1]!)
  const endHtml = num(lines[2]!)
  const startFragment = num(lines[3]!)
  const endFragment = num(lines[4]!)
  expect(startHtml).toBe(105)
  const all = bytes.encode(payload)
  const slice = (a: number, b: number) => new TextDecoder().decode(all.slice(a, b))
  expect(slice(startHtml, startHtml + 6)).toBe('<html>')
  expect(slice(startFragment - 20, startFragment)).toBe('<!--StartFragment-->')
  expect(slice(startFragment, endFragment)).toBe(fragment)
  expect(slice(endFragment, endFragment + 18)).toBe('<!--EndFragment-->')
  expect(endHtml).toBe(all.length)
  expect(slice(endHtml - 7, endHtml)).toBe('</html>')
  expect(all.length).toBeGreaterThan(payload.length)
})

test('writeRich runs PowerShell with the expected argv and no user text', async () => {
  clearPowerShellPath()
  const { $, calls } = fake()
  const result = await writeRich($, '<p>Secret Phrase</p>', 'Secret Phrase')
  expect(result.ok).toBe(true)
  expect(calls).toHaveLength(1)
  const { argv, init } = calls[0]!
  expect(argv.slice(0, 5)).toEqual([WINDOWS_POWERSHELL, '-NoProfile', '-NonInteractive', '-Sta', '-EncodedCommand'])
  expect(argv).toHaveLength(6)
  expect(argv.join(' ')).not.toContain('Secret Phrase')
  expect(init?.timeoutMs).toBe(5000)
  const script = decodeUtf16(argv[5]!)
  expect(script).toContain('HTML Format')
  expect(script).toContain('UnicodeText')
  expect(script).toContain('SetDataObject($data, $true, 5, 100)')
  expect(script).toContain('Add-Type -AssemblyName System.Windows.Forms')
  expect(script).toContain("$ProgressPreference = 'SilentlyContinue'")
  expect(script).toContain('[Console]::In.ReadLine()')
  expect(script).toContain('catch')
  expect(script).toContain('exit 1')
})

test('writeRich stdin carries the payload and the text as base64 lines', async () => {
  clearPowerShellPath()
  const { $, calls } = fake()
  await writeRich($, '<p>café \u{1F600}</p>', 'café \u{1F600}')
  const stdin = calls[0]!.init?.stdin ?? ''
  expect(stdin.endsWith('\n')).toBe(true)
  const lines = stdin.split('\n')
  expect(lines).toHaveLength(3)
  expect(lines[2]).toBe('')
  expect(decodeB64(lines[0]!)).toBe(cfHtml('<p>café \u{1F600}</p>'))
  expect(decodeB64(lines[1]!)).toBe('café \u{1F600}')
})

test('writeText with ui.copy refused sends an empty first line', async () => {
  clearPowerShellPath()
  const { $, calls, copies } = fake({ copied: false })
  const result = await writeText($, 'plain words')
  expect(result.ok).toBe(true)
  expect(copies).toEqual(['plain words'])
  expect(calls).toHaveLength(1)
  const lines = (calls[0]!.init?.stdin ?? '').split('\n')
  expect(lines[0]).toBe('')
  expect(decodeB64(lines[1]!)).toBe('plain words')
})

test('writeText prefers ui.copy and runs no program when it works', async () => {
  clearPowerShellPath()
  const { $, calls, copies } = fake({ copied: true })
  const result = await writeText($, 'plain words')
  expect(result).toEqual({ ok: true, value: null })
  expect(copies).toEqual(['plain words'])
  expect(calls).toHaveLength(0)
})

test('writeText falls back to PowerShell when ui.copy throws', async () => {
  clearPowerShellPath()
  const { $, calls } = fake({ copyThrows: true })
  const result = await writeText($, 'x')
  expect(result.ok).toBe(true)
  expect(calls).toHaveLength(1)
})

test('failures map to missing, timeout and failed', async () => {
  clearPowerShellPath()
  const cases: [() => Promise<never>, string][] = [
    [async () => { throw new Error('spawn ENOENT') }, 'missing'],
    [async () => { throw new Error('timed out') }, 'timeout'],
  ]
  for (const [run, kind] of cases) {
    const { $ } = fake({ run })
    const result = await writeRich($, '<p>a</p>', 'a')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.program).toBe('powershell')
      expect(result.failure.kind).toBe(kind)
    }
  }
  const { $ } = fake({ run: async () => ({ exitCode: 1, stdout: '', stderr: 'Clipboard busy\n' }) })
  const result = await writeRich($, '<p>a</p>', 'a')
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.failure.kind).toBe('failed')
    expect(result.failure.detail).toBe('Clipboard busy')
  }
})

test('findPowerShell uses powershell.exe when the Windows path is missing, and caches', async () => {
  clearPowerShellPath()
  const missing = fake({ exists: false })
  expect(await findPowerShell(missing.$)).toBe('powershell.exe')
  const present = fake({ exists: true })
  expect(await findPowerShell(present.$)).toBe('powershell.exe')
  expect(present.exists).toHaveLength(0)
  clearPowerShellPath()
  expect(await findPowerShell(present.$)).toBe(WINDOWS_POWERSHELL)
  expect(present.exists).toEqual([WINDOWS_POWERSHELL])
  const { $, calls } = fake({ exists: false })
  clearPowerShellPath()
  await writeRich($, '<p>a</p>', 'a')
  expect(calls[0]!.argv[0]).toBe('powershell.exe')
})

test('powershellVersion returns trimmed stdout', async () => {
  clearPowerShellPath()
  const { $, calls } = fake({ run: async () => ({ exitCode: 0, stdout: '5.1.19041.4648\r\n', stderr: '' }) })
  const result = await powershellVersion($)
  expect(result).toEqual({ ok: true, value: '5.1.19041.4648' })
  expect(calls[0]!.argv).toEqual([WINDOWS_POWERSHELL, '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'])
})

test('powershellVersion reports a missing program', async () => {
  clearPowerShellPath()
  const { $ } = fake({ run: async () => { throw new Error('spawn ENOENT') } })
  const result = await powershellVersion($)
  expect(result.ok).toBe(false)
})

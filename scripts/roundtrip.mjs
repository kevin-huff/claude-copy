#!/usr/bin/env node
// Hand-run check: writes a known formatted pair to the Windows clipboard and reads it back.
// It overwrites whatever is on your clipboard, so it refuses to run without --yes.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import module from 'node:module'

if (!process.argv.includes('--yes')) {
  console.error('This writes to the Windows clipboard and replaces what is on it.')
  console.error('Run it again with --yes to go ahead:  node scripts/roundtrip.mjs --yes')
  process.exit(2)
}

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18) || typeof module.registerHooks !== 'function') {
  console.error(`Node 22.18 or later is needed to load the TypeScript sources (this is ${process.versions.node}).`)
  process.exit(2)
}

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
      const file = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`)
      if (existsSync(file)) return nextResolve(pathToFileURL(file).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { writeRich, clearPowerShellPath, WINDOWS_POWERSHELL } = await import(pathToFileURL(resolve(root, 'hooks/clipboard.ts')).href)

const $ = {
  process: {
    run(argv, init = {}) {
      return new Promise((resolveRun, reject) => {
        const child = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
        const out = []
        const err = []
        let timedOut = false
        const timer = init.timeoutMs
          ? setTimeout(() => {
              timedOut = true
              child.kill('SIGKILL')
            }, init.timeoutMs)
          : null
        child.stdout.on('data', (chunk) => out.push(chunk))
        child.stderr.on('data', (chunk) => err.push(chunk))
        child.on('error', (error) => {
          if (timer) clearTimeout(timer)
          reject(error)
        })
        child.on('close', (exitCode) => {
          if (timer) clearTimeout(timer)
          if (timedOut) return reject(new Error('timed out'))
          resolveRun({
            exitCode: exitCode ?? 1,
            stdout: Buffer.concat(out).toString('utf8'),
            stderr: Buffer.concat(err).toString('utf8'),
          })
        })
        child.stdin.on('error', () => {})
        child.stdin.end(init.stdin ?? '')
      })
    },
  },
  fs: { exists: async (path) => existsSync(path) },
  env: { get: async (name) => process.env[name] },
}

const html =
  '<p>Round trip: <strong>bold</strong> text, an em dash \u2014 and \u201Ccurly quotes\u201D \u{1F600}</p>' +
  '<table><thead><tr><th>Name</th><th>Count</th></tr></thead><tbody><tr><td>apples</td><td>3</td></tr></tbody></table>'
const text = 'Round trip: bold text, an em dash \u2014 and \u201Ccurly quotes\u201D \u{1F600}\nName\tCount\napples\t3'

clearPowerShellPath()
const written = await writeRich($, html, text)
if (!written.ok) {
  console.error(`FAIL: the write did not work (${written.failure.program} ${written.failure.kind}: ${written.failure.detail})`)
  process.exit(1)
}

// Get-Clipboard in Windows PowerShell 5.1 decodes "HTML Format" in the ANSI code page (a .NET Framework 4.0
// compatibility quirk), which garbles every non-ASCII character. WPF's reader decodes it as UTF-8, as the format requires.
const readScript = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  'Add-Type -AssemblyName PresentationCore',
  '$h = [System.Windows.Clipboard]::GetText([System.Windows.TextDataFormat]::Html)',
  '$t = [System.Windows.Clipboard]::GetText([System.Windows.TextDataFormat]::UnicodeText)',
  '[Console]::Out.WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$h)))',
  '[Console]::Out.WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$t)))',
].join('\n')
const encoded = Buffer.from(readScript, 'utf16le').toString('base64')
const shell = existsSync(WINDOWS_POWERSHELL) ? WINDOWS_POWERSHELL : 'powershell.exe'
let read
try {
  read = await $.process.run([shell, '-NoProfile', '-NonInteractive', '-Sta', '-EncodedCommand', encoded], { timeoutMs: 10000 })
} catch (error) {
  console.error(`FAIL: could not read the clipboard back (${error.message})`)
  process.exit(1)
}
if (read.exitCode !== 0) {
  console.error(`FAIL: reading the clipboard back exited ${read.exitCode}: ${read.stderr.trim().split('\n')[0] ?? ''}`)
  process.exit(1)
}

const [htmlB64 = '', textB64 = ''] = read.stdout.split(/\r?\n/).map((line) => line.trim())
const gotHtml = Buffer.from(htmlB64, 'base64').toString('utf8')
const gotText = Buffer.from(textB64, 'base64').toString('utf8')

const problems = []
const start = gotHtml.indexOf('<!--StartFragment-->')
const end = gotHtml.indexOf('<!--EndFragment-->')
if (start < 0 || end < 0) {
  problems.push('HTML: no StartFragment/EndFragment markers in what the clipboard returned')
} else {
  const fragment = gotHtml.slice(start + '<!--StartFragment-->'.length, end)
  if (fragment !== html) problems.push(`HTML fragment differs\n  wrote: ${html}\n  read:  ${fragment}`)
}
const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '')
if (normalize(gotText) !== normalize(text)) problems.push(`Text differs\n  wrote: ${JSON.stringify(text)}\n  read:  ${JSON.stringify(gotText)}`)

if (problems.length === 0) {
  console.log('PASS: HTML fragment and plain text both came back unchanged')
  process.exit(0)
}
console.log('FAIL')
for (const problem of problems) console.log(problem)
process.exit(1)

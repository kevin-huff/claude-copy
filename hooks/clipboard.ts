import type { EngineInterface } from 'claude-code'
import type { Ran } from '../types'
import { runProgram } from './exec'

export const WINDOWS_POWERSHELL = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

const START = '<html><body><!--StartFragment-->'
const END = '<!--EndFragment--></body></html>'

const SCRIPT = `$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -AssemblyName System.Windows.Forms
  $htmlLine = [Console]::In.ReadLine()
  $textLine = [Console]::In.ReadLine()
  if ($null -eq $htmlLine) { $htmlLine = '' }
  if ($null -eq $textLine) { $textLine = '' }
  $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($textLine))
  $data = New-Object System.Windows.Forms.DataObject
  if ($htmlLine -ne '') {
    $payload = [Convert]::FromBase64String($htmlLine)
    $data.SetData('HTML Format', (New-Object System.IO.MemoryStream (,$payload)))
  }
  $data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $text)
  [System.Windows.Forms.Clipboard]::SetDataObject($data, $true, 5, 100)
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x2000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x2000))
  }
  return btoa(binary)
}

function utf8Base64(text: string): string {
  return bytesToBase64(encoder.encode(text))
}

function utf16leBase64(text: string): string {
  const bytes = new Uint8Array(text.length * 2)
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    bytes[i * 2] = unit & 0xff
    bytes[i * 2 + 1] = unit >> 8
  }
  return bytesToBase64(bytes)
}

const size = (text: string) => encoder.encode(text).length
const pad = (n: number) => String(n).padStart(10, '0')

export function cfHtml(fragment: string): string {
  const headerLength = size('Version:0.9\r\nStartHTML:0000000000\r\nEndHTML:0000000000\r\nStartFragment:0000000000\r\nEndFragment:0000000000\r\n')
  const startFragment = headerLength + size(START)
  const endFragment = startFragment + size(fragment)
  const endHtml = endFragment + size(END)
  const header =
    `Version:0.9\r\nStartHTML:${pad(headerLength)}\r\nEndHTML:${pad(endHtml)}\r\n` +
    `StartFragment:${pad(startFragment)}\r\nEndFragment:${pad(endFragment)}\r\n`
  return header + START + fragment + END
}

let powershellPath: string | null = null

export function clearPowerShellPath(): void {
  powershellPath = null
}

export async function findPowerShell($: EngineInterface): Promise<string> {
  if (powershellPath !== null) return powershellPath
  let found = false
  try {
    found = await $.fs.exists(WINDOWS_POWERSHELL)
  } catch {
    found = false
  }
  powershellPath = found ? WINDOWS_POWERSHELL : 'powershell.exe'
  return powershellPath
}

async function runScript($: EngineInterface, payload: string, text: string): Promise<Ran<null>> {
  const path = await findPowerShell($)
  const argv = [path, '-NoProfile', '-NonInteractive', '-Sta', '-EncodedCommand', utf16leBase64(SCRIPT)]
  const stdin = `${payload === '' ? '' : utf8Base64(payload)}\n${utf8Base64(text)}\n`
  const ran = await runProgram($, 'powershell', argv, { stdin, timeoutMs: 5000 })
  return ran.ok ? { ok: true, value: null } : ran
}

export function writeRich($: EngineInterface, html: string, text: string): Promise<Ran<null>> {
  return runScript($, cfHtml(html), text)
}

export async function writeText($: EngineInterface, text: string): Promise<Ran<null>> {
  try {
    const copied = await $.ui.copy({ text })
    if (copied.isCopied) return { ok: true, value: null }
  } catch {
    // fall through to PowerShell
  }
  return runScript($, '', text)
}

export async function powershellVersion($: EngineInterface): Promise<Ran<string>> {
  const path = await findPowerShell($)
  const ran = await runProgram(
    $,
    'powershell',
    [path, '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'],
    { timeoutMs: 5000 },
  )
  return ran.ok ? { ok: true, value: ran.value.stdout.trim() } : ran
}

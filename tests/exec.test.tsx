import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { runProgram } from '../hooks/exec'

declare const setTimeout: (callback: (...args: unknown[]) => void, ms: number) => unknown

const fake = (run: (...args: unknown[]) => Promise<unknown>) => ({ process: { run } }) as unknown as EngineInterface

test('a rejection near the time limit counts as a timeout', async () => {
  const $ = fake(async () => {
    await new Promise((r) => setTimeout(r, 60))
    throw new Error('process ended')
  })
  const r = await runProgram($, 'pandoc', ['pandoc'], { timeoutMs: 50 })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.failure.kind).toBe('timeout')
})

test('an immediate spawn error counts as missing', async () => {
  const $ = fake(async () => {
    throw new Error('spawn pandoc ENOENT')
  })
  const r = await runProgram($, 'pandoc', ['pandoc'], { timeoutMs: 5000 })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.failure.kind).toBe('missing')
})

test('a nonzero exit reports the first real stderr line', async () => {
  const $ = fake(async () => ({ exitCode: 1, stdout: '', stderr: '#< CLIXML\nFirst real error\nsecond' }))
  const r = await runProgram($, 'powershell', ['powershell'], { timeoutMs: 5000 })
  expect(r.ok).toBe(false)
  if (!r.ok) {
    expect(r.failure.kind).toBe('failed')
    expect(r.failure.detail).toBe('First real error')
  }
})

test('a zero exit is ok', async () => {
  const $ = fake(async () => ({ exitCode: 0, stdout: 'x', stderr: '' }))
  const r = await runProgram($, 'pandoc', ['pandoc'], { timeoutMs: 5000 })
  expect(r.ok).toBe(true)
})

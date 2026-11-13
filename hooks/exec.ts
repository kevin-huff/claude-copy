import type { EngineInterface, ProcessRunInit, ProcessRunResult } from 'claude-code'
import type { ProgramName, Ran } from '../types'

export async function runProgram(
  $: EngineInterface,
  program: ProgramName,
  argv: readonly string[],
  init: ProcessRunInit,
): Promise<Ran<ProcessRunResult>> {
  let result: ProcessRunResult
  const began = performance.now()
  try {
    result = await $.process.run(argv, init)
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error)
    const kind =
      /timed? ?out|timeout/i.test(message) ||
      (typeof init.timeoutMs === 'number' && performance.now() - began >= 0.9 * init.timeoutMs)
      ? 'timeout'
      : /ENOENT|ENOEXEC|not found|no such file|exec format|cannot start|could not start|spawn/i.test(message)
        ? 'missing'
        : 'failed'
    return { ok: false, failure: { program, kind, detail: message.slice(0, 200) } }
  }
  if (result.exitCode !== 0) {
    const line = String(result.stderr ?? '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('#< CLIXML'))
    return {
      ok: false,
      failure: { program, kind: 'failed', detail: (line ?? `exit code ${result.exitCode}`).slice(0, 200) },
    }
  }
  return { ok: true, value: result }
}

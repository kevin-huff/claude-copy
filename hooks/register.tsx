import type { EngineInterface, Register } from 'claude-code'

import type { CopyRequest, Settings } from '../types'
import { runCopy } from './copy'
import { doctorLines, doctorToast, runDoctor } from './doctor'
import { parseArgs, settingsFrom } from './input'
import { findBindings, helpLines, maybeHint } from './keys'

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text)

const badToast = (word: string) => `Unknown option "${cut(word, 30)}". Try /rcopy help`

const wholeNumber = (word: string) => /^\d{1,3}$/.test(word) && Number(word) >= 1

async function guarded($: EngineInterface, work: () => Promise<void>) {
  try {
    await work()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      $.ui.toast(`claude-copy hit an error: ${cut(message, 60)}`)
    } catch {
      // nothing left to tell the person with
    }
  }
}

async function copyAndHint($: EngineInterface, request: CopyRequest, settings: Settings) {
  await runCopy($, request, settings)
  await maybeHint($)
}

export const register: Register = (on, options) => {
  const settings: Settings = settingsFrom(options)
  let busy = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'rcopy',
      description: 'Copy the highlighted part of a Claude reply, or the last reply, with formatting',
      argumentHint: '[N] [md|plain|html] | help | doctor',
      immediate: true,
    })
    await $.command.register({
      name: 'rcopy-md',
      description: 'Copy the highlight or the last reply as Markdown',
      argumentHint: '[N]',
      immediate: true,
    })
    return result
  })

  on('turn.start', async (_, e, next) => {
    if (!e.agentId) busy = true
    return next(e)
  })

  on('turn.complete', async (_, e, next) => {
    if (!e.agentId) busy = false
    return next(e)
  })

  on('command.run', { command: 'rcopy' }, async ($, e) => {
    await guarded($, async () => {
      const fullscreen = e.presentation.isFullscreen
      const parsed = parseArgs(e.args)
      if (parsed.kind === 'help') {
        for (const line of helpLines(settings, await findBindings($))) $.ui.log(line)
      } else if (parsed.kind === 'doctor') {
        const checks = await runDoctor($, { isFullscreen: fullscreen, settings })
        for (const line of doctorLines(checks)) $.ui.log(line)
        $.ui.toast(doctorToast(checks))
      } else if (parsed.kind === 'bad') {
        $.ui.toast(badToast(parsed.word))
      } else {
        const variant = parsed.variant ?? settings.defaultVariant
        await copyAndHint($, { n: parsed.n, variant, command: `/rcopy ${e.args}`.trim(), busy, fullscreen }, settings)
      }
    })
    return {}
  })

  on('command.run', { command: 'rcopy-md' }, async ($, e) => {
    await guarded($, async () => {
      const words = e.args.trim().split(/\s+/).filter(Boolean)
      const first = words[0]
      if (first !== undefined && !wholeNumber(first)) return void $.ui.toast(badToast(first))
      if (words.length > 1) return void $.ui.toast(badToast(words[1]!))
      const n = first === undefined ? null : Number(first)
      const request = { n, variant: 'md' as const, command: `/rcopy-md ${e.args}`.trim(), busy, fullscreen: e.presentation.isFullscreen }
      await copyAndHint($, request, settings)
    })
    return {}
  })
}

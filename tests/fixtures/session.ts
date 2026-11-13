import type { EngineInterface, ProcessRunInit, SessionMessage } from 'claude-code'
import type { PandocDoc } from '../../types'
import { WINDOWS_POWERSHELL } from '../../hooks/clipboard'
import { CASES, DOCS } from './match'

// Invented replies. Each doc is /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for its markdown.
export const LATEST = 'Here is **bold** and a list:\n\n- one\n- two\n'
export const LATEST_DOC: PandocDoc = JSON.parse(
  '{"blocks":[{"t":"Para","c":[{"t":"Str","c":"Here"},{"t":"Space"},{"t":"Str","c":"is"},{"t":"Space"},{"t":"Strong","c":[{"t":"Str","c":"bold"}]},{"t":"Space"},{"t":"Str","c":"and"},{"t":"Space"},{"t":"Str","c":"a"},{"t":"Space"},{"t":"Str","c":"list:"}]},{"t":"BulletList","c":[[{"t":"Plain","c":[{"t":"Str","c":"one"}]}],[{"t":"Plain","c":[{"t":"Str","c":"two"}]}]]}],"pandoc-api-version":[1,20],"meta":{}}'
)
export const OLDER = 'Second reply about the *orchard* trees.\n'
export const OLDER_DOC: PandocDoc = JSON.parse(
  '{"blocks":[{"t":"Para","c":[{"t":"Str","c":"Second"},{"t":"Space"},{"t":"Str","c":"reply"},{"t":"Space"},{"t":"Str","c":"about"},{"t":"Space"},{"t":"Str","c":"the"},{"t":"Space"},{"t":"Emph","c":[{"t":"Str","c":"orchard"}]},{"t":"Space"},{"t":"Str","c":"trees."}]}],"pandoc-api-version":[1,20],"meta":{}}',
)

// What the fake pandoc prints for -t html and -t gfm, whatever tree it is given.
export const HTML_OUT = '<p>Here is <strong>bold</strong> and a list:</p><ul><li>one</li><li>two</li></ul>\n'
export const GFM_OUT = 'Here is **bold** and a list:\n\n  - one\n  - two\n'

export const TREES: Record<string, PandocDoc> = { [LATEST]: LATEST_DOC, [OLDER]: OLDER_DOC }
for (const c of CASES) TREES[c.markdown] = c.doc
for (const d of Object.values(DOCS)) TREES[d.markdown] = d.doc

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for each invented markdown.
export const V1_MD = "Here is the email:\n\nHi team,\n\nThe offsite moves to **May 14** at the lake lodge. Buses leave at 8am from the main office.\n\nPlease reply by Friday so we can book enough seats.\n\nThanks, Sam"
export const V1_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"email:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team,\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Strong\",\"c\":[{\"t\":\"Str\",\"c\":\"May\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"14\"}]},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Buses\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leave\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"8am\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"main\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"office.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"reply\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"we\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"can\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"enough\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"seats.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Thanks,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Sam\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
export const V2_MD = "Updated with the new date:\n\nHi team,\n\nThe offsite moves to **May 21** at the river lodge. Buses leave at 9am from the north lot.\n\nPlease reply by Friday so we can book enough seats.\n\nThanks, Sam"
export const V2_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Updated\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"with\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"new\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"date:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team,\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Strong\",\"c\":[{\"t\":\"Str\",\"c\":\"May\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"21\"}]},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"river\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Buses\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leave\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"9am\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"north\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lot.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Please\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"reply\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"by\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Friday\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"so\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"we\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"can\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"book\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"enough\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"seats.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Thanks,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Sam\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
export const D1_MD = "Draft:\n\nHi team,\n\nThe offsite moves to **May 14** at the lake lodge. Buses leave at 8am from the main office.\n\nThanks, Sam"
export const D1_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Draft:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hi\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"team,\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Strong\",\"c\":[{\"t\":\"Str\",\"c\":\"May\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"14\"}]},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Buses\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leave\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"8am\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"main\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"office.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Thanks,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Sam\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
export const D2_MD = "Shorter draft:\n\nHello all,\n\nThe offsite moves to **May 14** at the lake lodge. Buses leave at 8am from the main office.\n\nBest, Sam"
export const D2_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Shorter\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"draft:\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Hello\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"all,\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"offsite\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"moves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Strong\",\"c\":[{\"t\":\"Str\",\"c\":\"May\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"14\"}]},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lake\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"lodge.\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Buses\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"leave\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"at\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"8am\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"from\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"main\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"office.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Best,\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Sam\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
export const PLANS_MD = "Here is how the two plans compare.\n\n| Plan | Notes |\n|------|-------|\n| Basic starter | Includes one shared workspace and email support on weekdays |\n| Plus | Adds unlimited workspaces and phone support |\n\nThe Plus plan costs twice as much but saves time for larger teams.\n"
export const PLANS_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"how\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"two\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"plans\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"compare.\"}]},{\"t\":\"Table\",\"c\":[[],[{\"t\":\"AlignDefault\"},{\"t\":\"AlignDefault\"}],[0,0],[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Plan\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Notes\"}]}]],[[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Basic\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"starter\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Includes\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"one\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"shared\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"workspace\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"email\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"support\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"on\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"weekdays\"}]}]],[[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Plus\"}]}],[{\"t\":\"Plain\",\"c\":[{\"t\":\"Str\",\"c\":\"Adds\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"unlimited\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"workspaces\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"and\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"phone\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"support\"}]}]]]]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"Plus\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"plan\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"costs\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"twice\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"as\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"much\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"but\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"saves\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"time\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"for\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"larger\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"teams.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
export const GARDEN_MD = "The garden plan has three parts.\n\nPlant the tomatoes along the south fence.\n\nWater the beds early every morning.\n"
export const GARDEN_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"The\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"garden\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"plan\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"has\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"three\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"parts.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Plant\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"tomatoes\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"along\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"south\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"fence.\"}]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Water\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"beds\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"early\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"every\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"morning.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
TREES[V1_MD] = V1_DOC
TREES[V2_MD] = V2_DOC
TREES[D1_MD] = D1_DOC
TREES[D2_MD] = D2_DOC
TREES[PLANS_MD] = PLANS_DOC
TREES[GARDEN_MD] = GARDEN_DOC

export type ProgramReply = { exitCode: number; stdout: string; stderr: string } | Error

export const ok = (stdout = ''): ProgramReply => ({ exitCode: 0, stdout, stderr: '' })
export const failed = (stderr: string, exitCode = 1): ProgramReply => ({ exitCode, stdout: '', stderr })

export type FakeOptions = {
  selection?: { text: string; requestId?: string }
  replies?: string[] // oldest first, each after an invented prompt
  messages?: SessionMessage[]
  json?: ProgramReply
  html?: ProgramReply
  gfm?: ProgramReply
  powershell?: ProgramReply
  copied?: boolean
  env?: Record<string, string>
  messagesThrow?: string
}

export type Run = { argv: readonly string[]; stdin: string | undefined }

export function prompt(text: string): SessionMessage {
  return { role: 'user', text, toolUses: [] }
}

export function said(text: string): SessionMessage {
  return { role: 'assistant', text, toolUses: [] }
}

export function conversation(replies: readonly string[]): SessionMessage[] {
  return replies.flatMap((md, i) => [prompt(`Invented question ${i + 1}`), said(md)])
}

export function fakeSession(opts: FakeOptions = {}) {
  const toasts: string[] = []
  const copies: string[] = []
  const runs: Run[] = []
  const writes: Record<string, string> = {}
  const env: Record<string, string> = { HOME: '/home/tester', WSL_DISTRO_NAME: 'Ubuntu', ...(opts.env ?? {}) }
  const files: Record<string, string> = {
    '/plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'claude-copy', version: '0.1.0' }),
  }
  const messages = opts.messages ?? conversation(opts.replies ?? [OLDER, LATEST])

  const answer = (reply: ProgramReply) => {
    if (reply instanceof Error) throw reply
    return reply
  }

  const pandoc = (argv: readonly string[], stdin: string | undefined): ProgramReply => {
    const to = argv[argv.indexOf('-t') + 1]
    if (to === 'json') {
      if (opts.json) return opts.json
      const doc = TREES[stdin ?? '']
      return doc ? ok(JSON.stringify(doc)) : failed('pandoc: no fixture for this markdown', 64)
    }
    if (to === 'html') return opts.html ?? ok(HTML_OUT)
    if (to?.startsWith('gfm')) return opts.gfm ?? ok(GFM_OUT)
    return failed(`pandoc: unexpected argv ${argv.join(' ')}`, 64)
  }

  const $ = {
    env: { get: async (name: string) => env[name] },
    plugin: { root: '/plugin' },
    fs: {
      exists: async (path: string) => path === WINDOWS_POWERSHELL || path in files,
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async (path: string, content: string) => {
        writes[path] = content
      },
    },
    process: {
      run: async (argv: readonly string[], init: ProcessRunInit = {}) => {
        const stdin = typeof init.stdin === 'string' ? init.stdin : undefined
        runs.push({ argv, stdin })
        if (argv[0] === 'pandoc') return answer(pandoc(argv, stdin))
        if (argv[0] === WINDOWS_POWERSHELL || argv[0] === 'powershell.exe') return answer(opts.powershell ?? ok())
        throw new Error(`spawn ${argv[0]} ENOENT`)
      },
    },
    session: {
      messages: async () => {
        if (opts.messagesThrow) throw new Error(opts.messagesThrow)
        return messages
      },
    },
    ui: {
      selection: async () => opts.selection,
      copy: async (args: { text: string }) => {
        copies.push(args.text)
        return opts.copied === false ? { isCopied: false, reason: 'no clipboard here' } : { isCopied: true }
      },
      toast: (text: string) => {
        toasts.push(text)
      },
      log: () => {},
    },
  } as unknown as EngineInterface

  const pandocRuns = () => runs.filter((r) => r.argv[0] === 'pandoc')
  const powershellRuns = () => runs.filter((r) => r.argv[0] !== 'pandoc')

  return { $, toasts, copies, runs, writes, pandocRuns, powershellRuns }
}

const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

// The two stdin lines writeRich and writeText send PowerShell: the HTML Format payload ('' for none) and the text.
export function decodeStdin(stdin: string | undefined): { payload: string; text: string } {
  const [html = '', text = ''] = (stdin ?? '').split('\n')
  return { payload: html === '' ? '' : fromBase64(html), text: fromBase64(text) }
}

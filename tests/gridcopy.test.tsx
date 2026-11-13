import { expect, test } from 'claude-code/testing'
import type { CopyRequest, PandocDoc, Settings } from '../types'
import { clearPowerShellPath } from '../hooks/clipboard'
import { runCopy } from '../hooks/copy'
import { clearTreeCache } from '../hooks/pandoc'
import { TREES, decodeStdin, fakeSession } from './fixtures/session'

// Real /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks -t json for each invented markdown.
const TABLE_MD = "Here is the output:\n\n```\n\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 name \u2502 status \u2502\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 api  \u2502 up     \u2502\n\u2502 web  \u2502 down   \u2502\n\u2502 jobs \u2502 up     \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n```\n"
const TABLE_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"output\"},{\"t\":\"Str\",\"c\":\":\"}]},{\"t\":\"CodeBlock\",\"c\":[[\"\",[],[]],\"\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\\n\u2502 name \u2502 status \u2502\\n\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\\n\u2502 api  \u2502 up     \u2502\\n\u2502 web  \u2502 down   \u2502\\n\u2502 jobs \u2502 up     \u2502\\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\\n\"]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
const BOXES_MD = "Here is the layout:\n\n```\n\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 Front \u2502  \u2502 Queue \u2502  \u2502 Store \u2502\n\u2502 door  \u2502  \u2502 line  \u2502  \u2502 shelf \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n```\n\nEach box talks only to its neighbour.\n"
const BOXES_DOC: PandocDoc = JSON.parse("{\"blocks\":[{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Here\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"is\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"the\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"layout\"},{\"t\":\"Str\",\"c\":\":\"}]},{\"t\":\"CodeBlock\",\"c\":[[\"\",[],[]],\"\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\\n\u2502 Front \u2502  \u2502 Queue \u2502  \u2502 Store \u2502\\n\u2502 door  \u2502  \u2502 line  \u2502  \u2502 shelf \u2502\\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\\n\"]},{\"t\":\"Para\",\"c\":[{\"t\":\"Str\",\"c\":\"Each\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"box\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"talks\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"only\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"to\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"its\"},{\"t\":\"Space\"},{\"t\":\"Str\",\"c\":\"neighbour.\"}]}],\"pandoc-api-version\":[1,20],\"meta\":{}}")
TREES[TABLE_MD] = TABLE_DOC
TREES[BOXES_MD] = BOXES_DOC

const settings: Settings = { defaultVariant: 'rich', tableBorders: true, codeColors: true }

const req = (over: Partial<CopyRequest> = {}): CopyRequest => ({
  n: null,
  variant: 'rich',
  command: '/rcopy',
  busy: false,
  fullscreen: true,
  ...over,
})

const fresh = () => {
  clearTreeCache()
  clearPowerShellPath()
}

const INTRO_A = 'Here is the output:'
const TABLE = [
  '┌──────┬────────┐',
  '│ name │ status │',
  '├──────┼────────┤',
  '│ api  │ up     │',
  '│ web  │ down   │',
  '│ jobs │ up     │',
  '└──────┴────────┘',
]
const INTRO_B = 'Here is the layout:'
const DIAGRAM = [
  '┌───────┐  ┌───────┐  ┌───────┐',
  '│ Front │  │ Queue │  │ Store │',
  '│ door  │  │ line  │  │ shelf │',
  '└───────┘  └───────┘  └───────┘',
]
const CLOSING = 'Each box talks only to its neighbour.'

const cases: { name: string; replies: string[]; lines: string[] }[] = [
  { name: 'the whole table', replies: [TABLE_MD], lines: TABLE },
  { name: 'the intro and the table', replies: [TABLE_MD], lines: [INTRO_A, '', ...TABLE] },
  { name: 'the diagram alone', replies: [BOXES_MD], lines: DIAGRAM },
  { name: 'the intro and the diagram', replies: [BOXES_MD], lines: [INTRO_B, '', ...DIAGRAM] },
  { name: 'the diagram and the closing sentence', replies: [BOXES_MD], lines: [...DIAGRAM, '', CLOSING] },
]

for (const c of cases) {
  test(`a box-drawn highlight of ${c.name} inside a code block copies whole`, async () => {
    fresh()
    const s = fakeSession({ replies: c.replies, selection: { text: c.lines.join('\n') } })
    const outcome = await runCopy(s.$, req(), settings)
    expect(outcome.kind).toBe('formatted')
    expect(s.toasts.length).toBe(1)
    const sent = decodeStdin(s.powershellRuns()[0]!.stdin)
    const written = sent.text.split('\n').map((l) => l.trimEnd())
    for (const line of c.lines) expect(written).toContain(line)
  })
}

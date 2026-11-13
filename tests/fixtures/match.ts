import type { MatchCase, PandocDoc } from '../../types'

// Invented replies. Each doc is /usr/bin/pandoc 2.9.2.1 output of -f gfm+hard_line_breaks-emoji -t json for its markdown.
export const CASES: MatchCase[] = [
  {
    name: 'whole paragraph',
    markdown: 'The garden plan is ready.\n\nTomatoes go along the south fence where they get the most sun, and the herbs sit in pots near the kitchen door.\n\nLet me know if you want a planting calendar too.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'The' }, { t: 'Space' }, { t: 'Str', c: 'garden' }, { t: 'Space' }, { t: 'Str', c: 'plan' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'ready.' }] }, { t: 'Para', c: [{ t: 'Str', c: 'Tomatoes' }, { t: 'Space' }, { t: 'Str', c: 'go' }, { t: 'Space' }, { t: 'Str', c: 'along' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'south' }, { t: 'Space' }, { t: 'Str', c: 'fence' }, { t: 'Space' }, { t: 'Str', c: 'where' }, { t: 'Space' }, { t: 'Str', c: 'they' }, { t: 'Space' }, { t: 'Str', c: 'get' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'most' }, { t: 'Space' }, { t: 'Str', c: 'sun,' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'herbs' }, { t: 'Space' }, { t: 'Str', c: 'sit' }, { t: 'Space' }, { t: 'Str', c: 'in' }, { t: 'Space' }, { t: 'Str', c: 'pots' }, { t: 'Space' }, { t: 'Str', c: 'near' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'kitchen' }, { t: 'Space' }, { t: 'Str', c: 'door.' }] }, { t: 'Para', c: [{ t: 'Str', c: 'Let' }, { t: 'Space' }, { t: 'Str', c: 'me' }, { t: 'Space' }, { t: 'Str', c: 'know' }, { t: 'Space' }, { t: 'Str', c: 'if' }, { t: 'Space' }, { t: 'Str', c: 'you' }, { t: 'Space' }, { t: 'Str', c: 'want' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'planting' }, { t: 'Space' }, { t: 'Str', c: 'calendar' }, { t: 'Space' }, { t: 'Str', c: 'too.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'Tomatoes go along the south fence where they get the most sun, and the herbs sit in pots near the kitchen door.',
    shouldMatch: true,
  },
  {
    name: 'part of a sentence inside bold',
    markdown: 'The release notes say **every deploy must pass the smoke tests first** before anyone merges.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'The' }, { t: 'Space' }, { t: 'Str', c: 'release' }, { t: 'Space' }, { t: 'Str', c: 'notes' }, { t: 'Space' }, { t: 'Str', c: 'say' }, { t: 'Space' }, { t: 'Strong', c: [{ t: 'Str', c: 'every' }, { t: 'Space' }, { t: 'Str', c: 'deploy' }, { t: 'Space' }, { t: 'Str', c: 'must' }, { t: 'Space' }, { t: 'Str', c: 'pass' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'smoke' }, { t: 'Space' }, { t: 'Str', c: 'tests' }, { t: 'Space' }, { t: 'Str', c: 'first' }] }, { t: 'Space' }, { t: 'Str', c: 'before' }, { t: 'Space' }, { t: 'Str', c: 'anyone' }, { t: 'Space' }, { t: 'Str', c: 'merges.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'must pass the smoke',
    shouldMatch: true,
  },
  {
    name: 'list',
    markdown: 'Pack these for the hike:\n\n- Water bottle and a **filter**\n- Trail map of the north ridge\n- A light rain jacket\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Pack' }, { t: 'Space' }, { t: 'Str', c: 'these' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'hike:' }] }, { t: 'BulletList', c: [[{ t: 'Plain', c: [{ t: 'Str', c: 'Water' }, { t: 'Space' }, { t: 'Str', c: 'bottle' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Strong', c: [{ t: 'Str', c: 'filter' }] }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Trail' }, { t: 'Space' }, { t: 'Str', c: 'map' }, { t: 'Space' }, { t: 'Str', c: 'of' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'north' }, { t: 'Space' }, { t: 'Str', c: 'ridge' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'A' }, { t: 'Space' }, { t: 'Str', c: 'light' }, { t: 'Space' }, { t: 'Str', c: 'rain' }, { t: 'Space' }, { t: 'Str', c: 'jacket' }] }]] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: '• Water bottle and a filter\n• Trail map of the north ridge\n• A light rain jacket',
    shouldMatch: true,
  },
  {
    name: 'renumbered list',
    markdown: 'Steps to reset the router:\n\n1. Unplug the power cord\n1. Wait thirty seconds\n1. Plug it back in and watch the lights\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Steps' }, { t: 'Space' }, { t: 'Str', c: 'to' }, { t: 'Space' }, { t: 'Str', c: 'reset' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'router:' }] }, { t: 'OrderedList', c: [[1, { t: 'DefaultStyle' }, { t: 'Period' }], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Unplug' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'power' }, { t: 'Space' }, { t: 'Str', c: 'cord' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Wait' }, { t: 'Space' }, { t: 'Str', c: 'thirty' }, { t: 'Space' }, { t: 'Str', c: 'seconds' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Plug' }, { t: 'Space' }, { t: 'Str', c: 'it' }, { t: 'Space' }, { t: 'Str', c: 'back' }, { t: 'Space' }, { t: 'Str', c: 'in' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'watch' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'lights' }] }]]] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: '1. Unplug the power cord\n2. Wait thirty seconds\n3. Plug it back in and watch the lights',
    shouldMatch: true,
  },
  {
    name: 'heading through next paragraph',
    markdown: '## Choosing a tent\n\nA three-season tent covers most trips. Look for a full rain fly and at least two doors.\n\n## Sleeping bags\n\nPick a bag rated ten degrees below the coldest night you expect.\n',
    doc: { blocks: [{ t: 'Header', c: [2, ['choosing-a-tent', [], []], [{ t: 'Str', c: 'Choosing' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'tent' }]] }, { t: 'Para', c: [{ t: 'Str', c: 'A' }, { t: 'Space' }, { t: 'Str', c: 'three-season' }, { t: 'Space' }, { t: 'Str', c: 'tent' }, { t: 'Space' }, { t: 'Str', c: 'covers' }, { t: 'Space' }, { t: 'Str', c: 'most' }, { t: 'Space' }, { t: 'Str', c: 'trips.' }, { t: 'Space' }, { t: 'Str', c: 'Look' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'full' }, { t: 'Space' }, { t: 'Str', c: 'rain' }, { t: 'Space' }, { t: 'Str', c: 'fly' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'at' }, { t: 'Space' }, { t: 'Str', c: 'least' }, { t: 'Space' }, { t: 'Str', c: 'two' }, { t: 'Space' }, { t: 'Str', c: 'doors.' }] }, { t: 'Header', c: [2, ['sleeping-bags', [], []], [{ t: 'Str', c: 'Sleeping' }, { t: 'Space' }, { t: 'Str', c: 'bags' }]] }, { t: 'Para', c: [{ t: 'Str', c: 'Pick' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'bag' }, { t: 'Space' }, { t: 'Str', c: 'rated' }, { t: 'Space' }, { t: 'Str', c: 'ten' }, { t: 'Space' }, { t: 'Str', c: 'degrees' }, { t: 'Space' }, { t: 'Str', c: 'below' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'coldest' }, { t: 'Space' }, { t: 'Str', c: 'night' }, { t: 'Space' }, { t: 'Str', c: 'you' }, { t: 'Space' }, { t: 'Str', c: 'expect.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'Choosing a tent\n\nA three-season tent covers most trips. Look for a full rain fly and at least two doors.',
    shouldMatch: true,
  },
  {
    name: 'code block',
    markdown: 'Run these to count the lines:\n\n```\nfind . -name "*.txt" > files.txt\nsort -n counts.txt | tail -5\necho done\n```\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Run' }, { t: 'Space' }, { t: 'Str', c: 'these' }, { t: 'Space' }, { t: 'Str', c: 'to' }, { t: 'Space' }, { t: 'Str', c: 'count' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'lines:' }] }, { t: 'CodeBlock', c: [['', [], []], 'find . -name "*.txt" > files.txt\nsort -n counts.txt | tail -5\necho done\n'] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'sort -n counts.txt | tail -5\necho done',
    shouldMatch: true,
  },
  {
    name: 'code block with language label',
    markdown: 'Here is the helper:\n\n```python\ndef greet(name):\n    message = f"Hello, {name}!"\n    return message.upper()\n```\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Here' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'helper:' }] }, { t: 'CodeBlock', c: [['', ['python'], []], 'def greet(name):\n    message = f"Hello, {name}!"\n    return message.upper()\n'] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'python\ndef greet(name):\n    message = f"Hello, {name}!"\n    return message.upper()',
    shouldMatch: true,
  },
  {
    name: 'table',
    markdown: 'Here is how the two plans compare.\n\n| Plan | Notes |\n|------|-------|\n| Basic starter | Includes one shared workspace and email support on weekdays |\n| Plus | Adds unlimited workspaces and phone support |\n\nThe Plus plan costs twice as much but saves time for larger teams.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Here' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'how' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'two' }, { t: 'Space' }, { t: 'Str', c: 'plans' }, { t: 'Space' }, { t: 'Str', c: 'compare.' }] }, { t: 'Table', c: [[], [{ t: 'AlignDefault' }, { t: 'AlignDefault' }], [0, 0], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Plan' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Notes' }] }]], [[[{ t: 'Plain', c: [{ t: 'Str', c: 'Basic' }, { t: 'Space' }, { t: 'Str', c: 'starter' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Includes' }, { t: 'Space' }, { t: 'Str', c: 'one' }, { t: 'Space' }, { t: 'Str', c: 'shared' }, { t: 'Space' }, { t: 'Str', c: 'workspace' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'email' }, { t: 'Space' }, { t: 'Str', c: 'support' }, { t: 'Space' }, { t: 'Str', c: 'on' }, { t: 'Space' }, { t: 'Str', c: 'weekdays' }] }]], [[{ t: 'Plain', c: [{ t: 'Str', c: 'Plus' }] }], [{ t: 'Plain', c: [{ t: 'Str', c: 'Adds' }, { t: 'Space' }, { t: 'Str', c: 'unlimited' }, { t: 'Space' }, { t: 'Str', c: 'workspaces' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'phone' }, { t: 'Space' }, { t: 'Str', c: 'support' }] }]]]] }, { t: 'Para', c: [{ t: 'Str', c: 'The' }, { t: 'Space' }, { t: 'Str', c: 'Plus' }, { t: 'Space' }, { t: 'Str', c: 'plan' }, { t: 'Space' }, { t: 'Str', c: 'costs' }, { t: 'Space' }, { t: 'Str', c: 'twice' }, { t: 'Space' }, { t: 'Str', c: 'as' }, { t: 'Space' }, { t: 'Str', c: 'much' }, { t: 'Space' }, { t: 'Str', c: 'but' }, { t: 'Space' }, { t: 'Str', c: 'saves' }, { t: 'Space' }, { t: 'Str', c: 'time' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'larger' }, { t: 'Space' }, { t: 'Str', c: 'teams.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'Here is how the two plans compare.\n\n┌─────────┬───────────────────────────────┐\n│ Plan    │ Notes                         │\n├─────────┼───────────────────────────────┤\n│ Basic   │ Includes one shared workspace │\n│ starter │ and email support on weekdays │\n├─────────┼───────────────────────────────┤\n│ Plus    │ Adds unlimited workspaces and │\n│         │ phone support                 │\n└─────────┴───────────────────────────────┘\n\nThe Plus plan costs twice as much but saves time for larger teams.',
    shouldMatch: true,
  },
  {
    name: 'block quote',
    markdown: 'One reviewer left a note:\n\n> Please keep the old endpoint for one more release so mobile clients can update.\n\nI agree with that plan.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'One' }, { t: 'Space' }, { t: 'Str', c: 'reviewer' }, { t: 'Space' }, { t: 'Str', c: 'left' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'note:' }] }, { t: 'BlockQuote', c: [{ t: 'Para', c: [{ t: 'Str', c: 'Please' }, { t: 'Space' }, { t: 'Str', c: 'keep' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'old' }, { t: 'Space' }, { t: 'Str', c: 'endpoint' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'one' }, { t: 'Space' }, { t: 'Str', c: 'more' }, { t: 'Space' }, { t: 'Str', c: 'release' }, { t: 'Space' }, { t: 'Str', c: 'so' }, { t: 'Space' }, { t: 'Str', c: 'mobile' }, { t: 'Space' }, { t: 'Str', c: 'clients' }, { t: 'Space' }, { t: 'Str', c: 'can' }, { t: 'Space' }, { t: 'Str', c: 'update.' }] }] }, { t: 'Para', c: [{ t: 'Str', c: 'I' }, { t: 'Space' }, { t: 'Str', c: 'agree' }, { t: 'Space' }, { t: 'Str', c: 'with' }, { t: 'Space' }, { t: 'Str', c: 'that' }, { t: 'Space' }, { t: 'Str', c: 'plan.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: '▎ Please keep the old endpoint for one more release so mobile clients can update.',
    shouldMatch: true,
  },
  {
    name: 'link',
    markdown: 'See the [setup guide](https://example.com/docs/setup) for the full list of options.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'See' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Link', c: [['', [], []], [{ t: 'Str', c: 'setup' }, { t: 'Space' }, { t: 'Str', c: 'guide' }], ['https://example.com/docs/setup', '']] }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'full' }, { t: 'Space' }, { t: 'Str', c: 'list' }, { t: 'Space' }, { t: 'Str', c: 'of' }, { t: 'Space' }, { t: 'Str', c: 'options.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: 'See the setup guide for the full list of options.',
    shouldMatch: true,
  },
  {
    name: 'starts on the reply marker',
    markdown: 'Your laptop battery report shows 312 charge cycles. That is normal wear for a two-year-old machine, and capacity is still at 91 percent.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Your' }, { t: 'Space' }, { t: 'Str', c: 'laptop' }, { t: 'Space' }, { t: 'Str', c: 'battery' }, { t: 'Space' }, { t: 'Str', c: 'report' }, { t: 'Space' }, { t: 'Str', c: 'shows' }, { t: 'Space' }, { t: 'Str', c: '312' }, { t: 'Space' }, { t: 'Str', c: 'charge' }, { t: 'Space' }, { t: 'Str', c: 'cycles.' }, { t: 'Space' }, { t: 'Str', c: 'That' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'normal' }, { t: 'Space' }, { t: 'Str', c: 'wear' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'a' }, { t: 'Space' }, { t: 'Str', c: 'two-year-old' }, { t: 'Space' }, { t: 'Str', c: 'machine,' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'capacity' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'still' }, { t: 'Space' }, { t: 'Str', c: 'at' }, { t: 'Space' }, { t: 'Str', c: '91' }, { t: 'Space' }, { t: 'Str', c: 'percent.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: '⏺ Your laptop battery report shows 312 charge cycles. That is normal wear for a two-year-old machine, and capacity is still at 91 percent.',
    shouldMatch: true,
  },
  {
    name: 'tool output',
    markdown: 'I checked the config file and the port is set correctly.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'I' }, { t: 'Space' }, { t: 'Str', c: 'checked' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'config' }, { t: 'Space' }, { t: 'Str', c: 'file' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'port' }, { t: 'Space' }, { t: 'Str', c: 'is' }, { t: 'Space' }, { t: 'Str', c: 'set' }, { t: 'Space' }, { t: 'Str', c: 'correctly.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
    highlight: '  ⎿  Read 42 lines (ctrl+o to expand)\n     listen_port: 8080\n     log_level: info',
    shouldMatch: false,
  },
]

export const DOCS: Record<string, { markdown: string; doc: PandocDoc }> = {
  quotes: {
    markdown: 'He said "ship it" today.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'He' }, { t: 'Space' }, { t: 'Str', c: 'said' }, { t: 'Space' }, { t: 'Str', c: '"ship' }, { t: 'Space' }, { t: 'Str', c: 'it"' }, { t: 'Space' }, { t: 'Str', c: 'today.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
  },
  planB: {
    markdown: 'We picked plan A\nB. Go ahead with the backup if the vendor slips.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'We' }, { t: 'Space' }, { t: 'Str', c: 'picked' }, { t: 'Space' }, { t: 'Str', c: 'plan' }, { t: 'Space' }, { t: 'Str', c: 'A' }, { t: 'LineBreak' }, { t: 'Str', c: 'B.' }, { t: 'Space' }, { t: 'Str', c: 'Go' }, { t: 'Space' }, { t: 'Str', c: 'ahead' }, { t: 'Space' }, { t: 'Str', c: 'with' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'backup' }, { t: 'Space' }, { t: 'Str', c: 'if' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'vendor' }, { t: 'Space' }, { t: 'Str', c: 'slips.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
  },
  spread: {
    markdown: 'Morning shift opens the shop and counts the register drawer.\n\nDeliveries arrive between nine and ten, and someone signs for each crate, checks the invoice against the order sheet, and stacks the boxes in the back room by date.\n\nEvening shift closes out the till and locks the side door.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Morning' }, { t: 'Space' }, { t: 'Str', c: 'shift' }, { t: 'Space' }, { t: 'Str', c: 'opens' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'shop' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'counts' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'register' }, { t: 'Space' }, { t: 'Str', c: 'drawer.' }] }, { t: 'Para', c: [{ t: 'Str', c: 'Deliveries' }, { t: 'Space' }, { t: 'Str', c: 'arrive' }, { t: 'Space' }, { t: 'Str', c: 'between' }, { t: 'Space' }, { t: 'Str', c: 'nine' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'ten,' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'someone' }, { t: 'Space' }, { t: 'Str', c: 'signs' }, { t: 'Space' }, { t: 'Str', c: 'for' }, { t: 'Space' }, { t: 'Str', c: 'each' }, { t: 'Space' }, { t: 'Str', c: 'crate,' }, { t: 'Space' }, { t: 'Str', c: 'checks' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'invoice' }, { t: 'Space' }, { t: 'Str', c: 'against' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'order' }, { t: 'Space' }, { t: 'Str', c: 'sheet,' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'stacks' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'boxes' }, { t: 'Space' }, { t: 'Str', c: 'in' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'back' }, { t: 'Space' }, { t: 'Str', c: 'room' }, { t: 'Space' }, { t: 'Str', c: 'by' }, { t: 'Space' }, { t: 'Str', c: 'date.' }] }, { t: 'Para', c: [{ t: 'Str', c: 'Evening' }, { t: 'Space' }, { t: 'Str', c: 'shift' }, { t: 'Space' }, { t: 'Str', c: 'closes' }, { t: 'Space' }, { t: 'Str', c: 'out' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'till' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'locks' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'side' }, { t: 'Space' }, { t: 'Str', c: 'door.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
  },
  close: {
    markdown: 'Morning shift opens the shop and counts the register drawer. Evening shift closes out the till and locks the side door.\n',
    doc: { blocks: [{ t: 'Para', c: [{ t: 'Str', c: 'Morning' }, { t: 'Space' }, { t: 'Str', c: 'shift' }, { t: 'Space' }, { t: 'Str', c: 'opens' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'shop' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'counts' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'register' }, { t: 'Space' }, { t: 'Str', c: 'drawer.' }, { t: 'Space' }, { t: 'Str', c: 'Evening' }, { t: 'Space' }, { t: 'Str', c: 'shift' }, { t: 'Space' }, { t: 'Str', c: 'closes' }, { t: 'Space' }, { t: 'Str', c: 'out' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'till' }, { t: 'Space' }, { t: 'Str', c: 'and' }, { t: 'Space' }, { t: 'Str', c: 'locks' }, { t: 'Space' }, { t: 'Str', c: 'the' }, { t: 'Space' }, { t: 'Str', c: 'side' }, { t: 'Space' }, { t: 'Str', c: 'door.' }] }], 'pandoc-api-version': [1, 20], meta: {} },
  },
}

# claude-copy

A mod for Claude Code that copies part of a Claude reply with its formatting. Highlight text in full-screen mode, press Alt+C, and paste into Outlook, Teams, Word, Slack or Google Docs. Bold, italics, links, headings, lists, tables and code styling come along.

Claude Code copies a highlight as plain text, so the markdown structure is gone. With claude-copy the Windows clipboard holds two versions of the same passage at once: HTML for apps that understand formatting, and clean plain text for everything else. It runs on Windows through WSL.

## What it does

Say Claude writes this reply:

```
Here is a draft for the team:

> **Subject:** Friday deploy
>
> Hi all,
>
> - The **API changes** ship at 3 pm
> - Read the [rollout notes](https://example.com/rollout) first
```

Highlight the quoted part and copy it the usual way, and Outlook gets this:

```
▎ Subject: Friday deploy
▎ Hi all,
▎ • The API changes ship at 3 pm
▎ • Read the rollout notes first
```

The quote bars come along, the bold is gone and the link has lost its address. Highlight the same part and press Alt+C, and Outlook gets a bold subject line, a bulleted list and a working link. Pasted into Notepad, the same copy gives plain text with no markdown symbols.

The mod copies exactly what you highlighted. If the highlight starts mid-sentence, the copy starts there, and the words inside keep their formatting. It adds nothing to the conversation and never calls a model or the network.

## Requirements

- Windows 10 or 11 with WSL (Windows Subsystem for Linux). Windows only, through WSL, for now.
- Windows Terminal, or another terminal that Claude Code runs full screen in.
- Claude Code 2.1.323 or later. Mods are in early access, so a later Claude Code release may change the API this mod uses.
- Claude Code's full-screen mode. Add `"tui": "fullscreen"` to `~/.claude/settings.json`, or set `CLAUDE_CODE_NO_FLICKER=1`, then start a new session. Highlights can only be read in this mode.
- pandoc 2.9 or later in WSL: `sudo apt install pandoc`. The mod is tested with 2.9.2.1 (what apt installs on Ubuntu 22.04), 3.1.3 (Ubuntu 24.04) and 3.14. If apt gives you an older one, download a newer pandoc from https://github.com/jgm/pandoc/releases.
- Windows PowerShell 5.1, which ships with Windows. The mod looks for it at `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe` and then for `powershell.exe` on your PATH.

## Install

Clone the repository into your skills folder:

```
git clone https://github.com/kevin-huff/claude-copy ~/.claude/skills/claude-copy
```

Start a new Claude Code session. Running `claude plugin list` should show `rcopy@skills-dir` as loaded. The plugin is named `rcopy` because Claude Code reserves names that start with `claude-`.

Two other ways to load it:

- For one session only: `claude --plugin-dir /path/to/claude-copy`.
- Always, from any folder: add the folder to `CLAUDE_CODE_PLUGIN_DIRS` under `env` in `~/.claude/settings.json`. The value is a list separated by colons.

Then run `/rcopy doctor` to confirm everything is in place.

## Bind Alt+C

Claude Code has no default binding for Alt+C. Create `~/.claude/keybindings.json`, or add this block to the `bindings` list if the file exists:

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "alt+c": "command:rcopy",
        "alt+m": "command:rcopy-md"
      }
    }
  ]
}
```

Claude Code watches this file, so the key works right away with no restart. `alt+m` is optional: it runs `/rcopy-md` and gives you a second key that always copies Markdown. A key binding cannot pass arguments, which is why `/rcopy-md` exists as its own command.

If you haven't bound a key, the mod tells you how once, in a dim line in the transcript, and then stays quiet. If you use a custom Claude config folder, the file lives in the folder named by `CLAUDE_CONFIG_DIR`.

## Usage

Highlight part of a Claude reply with the mouse, then press Alt+C or run `/rcopy`. Pressing the key clears the highlight. To copy the same passage in another form, highlight it again first.

With nothing highlighted, the whole last reply is copied. A highlight spread across several lines, a list or a table works the same way.

| Command | What it copies |
| --- | --- |
| `/rcopy` | The highlight or the last reply, in your default form (formatted unless you changed it) |
| `/rcopy 2` | The whole second-last reply. 1 is the last reply. Any highlight is ignored. Works for 1 to 999. |
| `/rcopy md` | The Markdown source of the passage |
| `/rcopy plain` | Clean plain text only, with no HTML on the clipboard |
| `/rcopy html` | The HTML source, as text, for pasting into an HTML editor |
| `/rcopy 3 md` | A number and a form word, in either order |
| `/rcopy-md` | Same as `/rcopy md`, and takes an optional number. Meant for a second key. |
| `/rcopy help` | Lists the commands, your bound keys and your settings |
| `/rcopy doctor` | Checks the setup and prints a fix for each problem |

Form words have a few spellings: `rich` or `formatted`, `md` or `markdown`, `plain` or `text`, and `html`. `rich` is the default setting: HTML plus plain text.

Every copy ends in one short pop-up message. Examples:

- `Copied 3 paragraphs with formatting`
- `Copied a code block with formatting`
- `Copied the last reply as Markdown`
- `Copied the 2nd-last reply as plain text`
- `Copied as plain text: pandoc isn't installed (sudo apt install pandoc)`
- `Copied as Markdown: pandoc failed. Run /rcopy doctor`
- `Copied 2 paragraphs with formatting (left out a line from outside the reply)`
- `Nothing copied: there is no 5th-last reply`

If the pop-up says "(left out a line from outside the reply)", one line of your highlight was outside the reply, such as the next prompt, so the mod left it out. With two such lines it says "(left out 2 lines from outside the reply)". The rest of the copy is unaffected.

If the pop-up starts with "Copied as Markdown", pandoc could not run and nothing was highlighted, so the mod copied the reply's Markdown source.

If the pop-up ends with "(highlights need full-screen mode)", the mod could not read a highlight because Claude Code is not in full-screen mode, so it copied the last reply instead.

## What formatting comes through

- Bold, italics, strikethrough and inline code
- Links, with their addresses
- Headings
- Bulleted, numbered and nested lists, including a list that starts partway through (the numbers stay right)
- Task lists, as ☐ and ☑
- Tables, with borders, a shaded header row and column alignment
- Block quotes, with a left border
- Code blocks in a monospace font with syntax colors
- Horizontal rules
- Emoji characters. Shortcodes such as :wave: stay as typed, the way Claude Code shows them

The mod sets no font or color on body text, so the app you paste into uses its own default.

These apps keep the formatting: Outlook, Teams, Word, Google Docs and other rich-text editors. Slack's message box handles most of it, but it has no tables, so a table may paste as rows of text. Plain-text targets such as Notepad or a terminal get clean plain text with no markdown symbols: list markers stay as `-` and `1.`, links show their address in parentheses, and tables become tab-separated rows.

## Settings

Open `/config` and look for the three rcopy rows.

| Setting | Default | What it does |
| --- | --- | --- |
| What Alt+C and /rcopy copy | rich | The form copied when you give no form word: `rich`, `md`, `plain` or `html` |
| Table borders | on | Draws borders around table cells in formatted copies |
| Code colors | on | Colors the syntax in code blocks of formatted copies |

`/rcopy-md` always copies Markdown, whatever the default is.

## Doctor

`/rcopy doctor` prints one line per check in the transcript and shows a one-line pop-up with the result. The model never sees any of it. A failed check comes with its fix.

- Full-screen mode: on, or how to turn it on
- WSL: confirms the mod is running inside WSL
- pandoc: found, and version 2.9 or later
- Windows PowerShell: found and starting, with its version and path
- Alt+C: a key in the `Chat` block of `keybindings.json` runs `/rcopy`, or the block to add
- claude-copy: the mod version and your settings
- Last copy: how the previous copy ended and how long it took

## Troubleshooting

When something goes wrong, the clipboard still ends up holding the plain text you highlighted (or the whole reply when nothing was highlighted), never less than Claude Code's own copy. The pop-up says what happened.

| Pop-up says | What it means and what to do |
| --- | --- |
| formatting only applies to Claude's replies | You highlighted tool-call output. Plain text was copied. |
| that highlight isn't in a reply I can read | The mod could not find the highlight in any reply. This is also what you see when you highlight your own message or an interface panel. If Claude was still writing, press Alt+C again when it finishes. |
| that highlight isn't in the newest replies | The mod stops looking after about 0.7 seconds, newest replies first, and ran out of time before it found the highlight. Long sessions with many similar replies cause it, and so can a first copy while pandoc starts slowly. Copy again, or highlight a longer passage so fewer replies look alike. |
| Copied as Markdown: ... | pandoc could not run and nothing was highlighted, so the whole reply's Markdown source was copied. The text after the colon says why. |
| (left out a line from outside the reply) | A line of the highlight was outside the reply, such as the next prompt. The mod left it out and copied the rest. |
| pandoc isn't installed | Run `sudo apt install pandoc` |
| pandoc failed. Run /rcopy doctor | pandoc is installed but errored. Doctor shows its version. If it is older than 2.9, install a newer one from https://github.com/jgm/pandoc/releases. |
| pandoc took over 5 seconds. Try again | pandoc hung. Try again, then run `/rcopy doctor`. |
| Windows PowerShell wasn't found | Check that `/mnt/c` is mounted and WSL interop is on, then run `/rcopy doctor` |
| the Windows clipboard refused the formatted copy | Another app held the clipboard. Try again. |
| PowerShell took over 5 seconds | Try again. A first start after boot can be slow. |
| (highlights need full-screen mode) | Turn on `"tui": "fullscreen"` and start a new session |
| Alt+C: `<key>` runs /rcopy in the "`<context>`" context, but command keys only work in "Chat" | In `/rcopy doctor`. The binding sits in a block other than `"context": "Chat"`. Move it into a Chat block as shown in "Bind Alt+C". |
| Nothing copied: no Claude reply yet | There is no reply to copy in this session |
| Nothing copied: the clipboard write failed | Run `/rcopy doctor` |

A typical copy takes well under half a second. Every copy writes a record to `$XDG_STATE_HOME/claude-copy/last-run.json`, which is `~/.local/state/claude-copy/last-run.json` by default. It holds the highlighted text, which reply matched, how the match was made, a summary of what was copied, the HTML size and the time each step took. It stays on your machine and the mod never sends it anywhere. Check it before sharing it in a bug report, since it contains your highlighted text.

## How it works

1. It reads the highlight from Claude Code and the session's messages, and groups them into replies: everything Claude wrote between two of your prompts.
2. A cheap text check picks the reply that could contain the highlight. pandoc turns that reply's Markdown into a tree, and the mod lines the highlight up with the visible text in the tree.
3. It cuts the tree to the highlighted range, keeping only the containers that still hold something, and writes the result as HTML and as plain text.
4. It adds inline styles to the HTML, because Outlook ignores style sheets: borders and padding on table cells, a monospace font on code, colors on code syntax.
5. It builds the Windows "HTML Format" payload and sends it, with the plain text, to Windows PowerShell as base64 on standard input. PowerShell puts both on the clipboard in a single write.

Any failing step falls back to copying plain text.

## Limits

- Windows through WSL only, for now. The clipboard writer sits behind one function, so other systems could be added later.
- Highlights need Claude Code's full-screen mode. Without it, the mod copies whole replies.
- A highlight in a reply that Claude is still writing may fall back to plain text. Press Alt+C again after it finishes.
- A table highlighted on its own copies as a table, even when its cells wrap. Very wide tables that Claude Code draws as "Header: value" blocks, and highlights that start or end partway through a cell, may still fall back to plain text. A table copies whole when any part of it is in the range.
- Only Claude's replies get formatting. Your own messages, tool output and panels copy as plain text.
- The search for a highlight stops after about 0.7 seconds. A short highlight in a long session full of similar replies can run out of time and copy as plain text.
- If the matched passage is much shorter or longer than your highlight (under half, or over a quarter more), the mod treats it as no match and falls back to plain text. That keeps it from copying something you didn't select.

## Development

The three checks:

```
claude plugin validate .
claude plugin test .
npx -y -p typescript@5.6.3 tsc -p .
```

The type check needs `.claude-plugin/types/`, which Claude Code writes the first time a session loads the mod. The tests use a fake Claude Code engine, so they never touch the clipboard or start PowerShell.

To test against the Windows clipboard itself, run this by hand:

```
node scripts/roundtrip.mjs --yes
```

It writes a known formatted pair to the Windows clipboard, reads both parts back and compares them. It replaces whatever you had copied, so it refuses to run without `--yes`. It needs Node 22.18 or later.

The code lives in `hooks/`, one small module per job, and `hooks/copy.ts` runs the pipeline.

## License

This is free and unencumbered software released into the public domain under the Unlicense. See [LICENSE](LICENSE).

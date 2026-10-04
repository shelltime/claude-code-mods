# shelltime-statusline

The [ShellTime](https://shelltime.xyz) statusline as a Claude Code mod. It draws the ShellTime statusline in a band above the prompt. It runs in the terminal and in the Code tab of the Claude desktop app, where the `statusLine` command from `settings.json` is not drawn.

In the terminal it is the same line as `shelltime cc statusline`:

```
🌿 main* | 🤖 Opus 5.5 | 💰 $1.23 | 📊 $12.50 | 🚦 5h:23% 7d:45% | ⏱️ 1h5m | 📈 42%
```

In the desktop app each segment is a rounded pill, in tones that read on the light and the dark theme. Quota and context get a small bar beside each percentage. The model is left out there, since the composer's footer already shows it.

```
╭─────────╮ ╭─────────╮ ╭───────────╮ ╭───────────────────────────╮ ╭─────────╮ ╭──────────────╮
│ 🌿 main*│ │ 💰 $1.23│ │ 📊 $12.50 │ │ 🚦 5h ━━── 23%  7d ━━━─ 45%│ │ ⏱️ 1h5m │ │ 📈 ━━── 42%  │
╰─────────╯ ╰─────────╯ ╰───────────╯ ╰───────────────────────────╯ ╰─────────╯ ╰──────────────╯
```

| Segment | Shows | Color | Link |
| --- | --- | --- | --- |
| 🌿 | Git branch, with `*` when the tree is dirty | green, gray `-` outside a repo | |
| 🤖 | Model (terminal only) | | |
| 💰 | This session's cost | cyan | the session on shelltime.xyz |
| 📊 | Today's Claude Code cost | yellow (amber on desktop), gray `-` with none | your coding agent page |
| 🚦 | 5-hour and 7-day quota used | green, yellow from 50%, red from 80%; on desktop each bucket has its own bar and color | claude.ai usage |
| ⏱️ | Today's AI agent time | magenta, gray `-` with none | your profile |
| 📈 | Context window used, with a bar on desktop | green, yellow from 50%, red from 80% | |

## Install

```sh
claude plugin marketplace add shelltime/claude-code-mods
claude plugin install shelltime-statusline@shelltime
```

Desktop sessions on the same machine load the same installed plugins.

## Configuration

There is nothing to configure in the mod. It reads the ShellTime CLI's own config file, `~/.shelltime/config.yaml` (or `.yml` / `.toml`, with `config.local.*` merged over it), in the same order the CLI does. Run `shelltime init` once and the mod picks up your token. Changes to the file are picked up on the next refresh.

The mod doesn't need the `shelltime` binary or its daemon. Without a token it still shows git, model, session cost, quota and context. Daily cost and agent time show `-`, and nothing is sent to ShellTime.

## Where the numbers come from

| | `shelltime cc statusline` | this mod |
| --- | --- | --- |
| git | the daemon runs `git` | runs the same `git` commands (`GIT_OPTIONAL_LOCKS=0`) |
| model, session cost, context | Claude Code's statusline JSON | the same figures, from Claude Code directly |
| quota | the daemon calls Anthropic's usage API with the OAuth token from the Keychain | the rate limits Claude Code already read from its last API response. No Keychain access, works on any OS |
| daily cost, agent time | the daemon queries ShellTime's API | the same GraphQL query, at most once every 15 s |
| session → project mapping | sent to ShellTime's API | the same request, once per session and directory |

Like the native statusline, it refreshes as the conversation changes: when you send a prompt, after each tool call, and when a turn ends. It doesn't poll while the session is idle.

## Terminal

If `~/.claude/settings.json` also has a `statusLine` running `shelltime cc statusline`, the terminal shows both lines. Keep both, or remove one.

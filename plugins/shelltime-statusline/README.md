# shelltime-statusline

The [ShellTime](https://shelltime.xyz) statusline as a Claude Code mod. It draws the ShellTime statusline in a band above the prompt. It runs in the terminal and in the Code tab of the Claude desktop app, where the `statusLine` command from `settings.json` is not drawn.

In the terminal it is the same line as `shelltime cc statusline`, in Claude Code's theme colors, so it follows `/theme`:

```
🌿 main* | 🤖 Opus 5.5 | 💰 $1.23 | 📊 $12.50 | 🚦 5h:23% 7d:45% | ⏱️ 1h5m | 📈 42%
```

In the desktop app it is one flat row, with no borders or padding, in tones that read on the light and the dark theme. Quota and context get a thin bar beside each percentage. The model is left out there, since the composer's footer already shows it.

```
🌿 main*   💰 $1.23   📊 $12.50   🚦 5h ━━── 23%  7d ━━━─ 45%   ⏱️ 1h5m   📈 ━━── 42%
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

The statusline doesn't need the `shelltime` binary or its daemon. Without a token it still shows git, model, session cost, quota and context. Daily cost and agent time show `-`, and nothing is sent to ShellTime. Linking pull requests (below) is the one feature that uses the CLI.

## Where the numbers come from

| | `shelltime cc statusline` | this mod |
| --- | --- | --- |
| git | the daemon runs `git` | runs the same `git` commands (`GIT_OPTIONAL_LOCKS=0`) |
| model, session cost, context | Claude Code's statusline JSON | the same figures, from Claude Code directly |
| quota | the daemon calls Anthropic's usage API with the OAuth token from the Keychain | the rate limits Claude Code already read from its last API response. No Keychain access, works on any OS |
| daily cost, agent time | the daemon queries ShellTime's API | the same GraphQL query, at most once every 15 s |
| session → project mapping | sent to ShellTime's API | the same request, once per session and directory |
| session → pull requests | | `shelltime cc pr`, after `gh pr create` prints a PR URL |

Like the native statusline, it refreshes as the conversation changes: when you send a prompt, after each tool call, and when a turn ends. It doesn't poll while the session is idle.

## Pull request links

When a Bash call runs `gh pr create`, the mod reads the PR URLs that `gh` printed on stdout. Commands that chain several `gh pr create` calls are covered too. It then runs:

```sh
shelltime cc pr --session-id <session id> <pr url>...
```

The CLI hands the URLs to the ShellTime daemon, which sends them to ShellTime, and they show up on the session. Without a daemon the CLI sends them itself.

- The mod looks for `~/.shelltime/bin/shelltime` first, then `shelltime` on `PATH`.
- Each URL is sent once per session. If the CLI can't be started, the next `gh pr create` that prints the URL tries again, and the failure goes to Claude Code's debug log.
- If the CLI can't be found, or is too old to have `cc pr`, nothing is linked. Errors from the CLI itself (not logged in, server unreachable) go to `~/.shelltime/log.log`.
- This runs from a `PostToolUse` hook, in the background, after the tool returns. It never delays or changes the Bash result Claude sees.

### Session cost comment

If the ShellTime GitHub App is installed on the repository, ShellTime comments on each linked github.com PR, as the app. The comment shows:

- the session's cost in USD
- tokens: total, input, output, cache read and cache write
- duration and active time
- the model
- prompts and lines changed
- a link to the session on shelltime.xyz, which only you can open

The comment is posted a couple of minutes after the PR is linked. ShellTime edits the same comment 30 minutes and 24 hours later, so it ends with the whole session's numbers.

- If you turned off showing your AI cost publicly on shelltime.xyz, the comment leaves out the USD amounts.
- Delete the comment and it is not posted again.
- Only PRs opened by a GitHub account linked to your ShellTime account get a comment. If you signed in to ShellTime without GitHub, link your GitHub account first.
- Without the app on the repository, nothing is posted.
- Nothing is posted for GitHub Enterprise hosts.

The mod and the CLI do nothing extra for this: ShellTime's server posts the comment once the PR is linked.

## Terminal

If `~/.claude/settings.json` also has a `statusLine` running `shelltime cc statusline`, the terminal shows both lines. Keep both, or remove one.

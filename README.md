# ShellTime Claude Code mods

[Claude Code](https://claude.com/claude-code) mods by [ShellTime](https://shelltime.xyz).

A mod is a Claude Code plugin made of function hooks: a small TypeScript module that can draw its own UI, such as a band above the prompt, a pane or a status entry, and react to the session. Mods run in the terminal and in the Code tab of the Claude desktop app.

| Mod | What it does |
| --- | --- |
| [`shelltime-statusline`](plugins/shelltime-statusline) | The ShellTime statusline (git, model, session and daily cost, quota, agent time, context) above the prompt, in the terminal and the desktop app |

## Install

```sh
claude plugin marketplace add shelltime/claude-code-mods
claude plugin install shelltime-statusline@shelltime
```

Or from inside Claude Code: `/plugin marketplace add shelltime/claude-code-mods`, then `/plugin install shelltime-statusline@shelltime`.

The mods read the ShellTime CLI's config (`~/.shelltime/config.*`). Run `shelltime init` once to sign in.

## Develop

```sh
# check the manifest and what the module hooks and calls
claude plugin validate plugins/shelltime-statusline

# run the tests
claude plugin test plugins/shelltime-statusline

# try it in a session; edits hot-reload
claude --plugin-dir plugins/shelltime-statusline
```

The engine writes the API types beside a loaded mod in `.claude-plugin/types/`, along with a `tsconfig.json`, so `tsc -p plugins/shelltime-statusline` type-checks it.

## License

MIT

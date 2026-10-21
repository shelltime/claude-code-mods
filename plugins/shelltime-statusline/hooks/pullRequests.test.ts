import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ToolCallResult } from 'claude-code'

import { createdPullRequestUrls, extractPullRequestUrls, isPrCreateCommand } from './pullRequests'

const CLI = '/home/me/.shelltime/bin/shelltime'
const PR_1 = 'https://github.com/shelltime/cli/pull/318'
const PR_2 = 'https://github.com/shelltime/web/pull/77'

function ran(exitCode = 0, stderr = '') {
  return { value: { exitCode, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false } }
}

// What the next Bash call answers, and the session it runs in.
type Shell = { sessionId: string; answer: ToolCallResult }

// Beneath the plugin: HOME, a clock, the session, and a Bash that answers
// whatever the test last set.
function base(on: On) {
  mock.env(on, { HOME: '/home/me' })
  const shell: Shell = { sessionId: 'sess-1', answer: { result: {} } }
  on('session.id', () => ({ value: shell.sessionId }))
  on('tool.call', () => shell.answer)
  return { clock: mock.clock(on, { now: Date.UTC(2026, 9, 8, 12) }), shell }
}

// The world beneath the plugin, with every `shelltime` command it runs
// recorded (the statusline's own `git` refresh is answered and left out);
// `missing` names executables that cannot start.
function world(on: On, missing: string[] = []) {
  const { clock, shell } = base(on)
  const runs: string[][] = []
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') return ran(128)
    runs.push([...e.argv])
    if (missing.includes(e.argv[0] ?? '')) throw new Error(`spawn ${e.argv[0]} ENOENT`)
    return ran()
  })
  return { clock, shell, runs }
}

function bash($: Engine, shell: Shell, command: string, stdout: string, sessionId = 'sess-1') {
  shell.sessionId = sessionId
  shell.answer = { result: { stdout, stderr: '', interrupted: false } }
  return $.tool.call({ tool: 'Bash', command, description: 'Open a PR' })
}

test('spots gh pr create and the PR URLs it printed', () => {
  expect(isPrCreateCommand('gh pr create --title x --body y')).toBe(true)
  expect(isPrCreateCommand('cd ../web && gh  pr   create --fill')).toBe(true)
  expect(isPrCreateCommand('gh pr view 1')).toBe(false)
  expect(isPrCreateCommand('gh pr list')).toBe(false)

  expect(
    extractPullRequestUrls(`Creating pull request for x into main\n\n${PR_1}\n${PR_2}\n${PR_1}\n`),
  ).toEqual([PR_1, PR_2])
  expect(extractPullRequestUrls('https://ghe.example.com/team/app/pull/42')).toEqual([
    'https://ghe.example.com/team/app/pull/42',
  ])
  expect(extractPullRequestUrls('https://github.com/o/r/issues/1')).toEqual([])

  expect(createdPullRequestUrls('gh pr create', `${PR_1}\n`)).toEqual([PR_1])
  expect(createdPullRequestUrls('gh pr view 1', `${PR_1}\n`)).toEqual([])
  expect(createdPullRequestUrls('gh pr create', '')).toEqual([])
})

test('links every PR a gh pr create printed to the session, once', async ($, on) => {
  const { clock, shell, runs } = world(on)

  await bash($, shell, `gh pr create --fill && cd ../web && gh pr create --fill`, `${PR_1}\n${PR_2}\n`)
  await clock.settle()
  expect(runs).toEqual([[CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1, PR_2]])

  // The same PR printed again (say, by a retry) is not sent twice.
  await bash($, shell, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  expect(runs).toHaveLength(1)

  // Another session that opens the same PR still gets it.
  await bash($, shell, 'gh pr create --fill', `${PR_1}\n`, 'sess-2')
  await clock.settle()
  expect(runs[1]).toEqual([CLI, 'cc', 'pr', '--session-id', 'sess-2', PR_1])
})

test('the Bash result reaches the model unchanged', async ($, on) => {
  const { clock, shell } = world(on)

  const result = await bash($, shell, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()

  expect(result).toEqual({ result: { stdout: `${PR_1}\n`, stderr: '', interrupted: false } })
})

test('leaves other commands and tools alone', async ($, on) => {
  const { clock, shell, runs } = world(on)

  await bash($, shell, `gh pr view ${PR_1}`, `${PR_1}\n`)
  await bash($, shell, 'gh pr create --fill', 'no url here\n')
  shell.answer = { result: { stdout: `gh pr create ${PR_1}` } }
  await $.tool.call({ tool: 'Read', file_path: '/work/notes.md' })
  await clock.settle()

  expect(runs).toEqual([])
})

test('a gh pr create that failed or was refused links nothing', async ($, on) => {
  const { clock, shell, runs } = world(on)

  shell.answer = { isError: true, result: `${PR_1}\nExit code 1`, text: `${PR_1}\nExit code 1` }
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill && false', description: 'Open a PR' })
  shell.answer = { deny: 'not here' }
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill', description: 'Open a PR' })
  await clock.settle()

  expect(runs).toEqual([])
})

test('falls back to shelltime on PATH when ~/.shelltime/bin has none', async ($, on) => {
  const { clock, shell, runs } = world(on, [CLI])

  await bash($, shell, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  expect(runs).toEqual([
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
    ['shelltime', 'cc', 'pr', '--session-id', 'sess-1', PR_1],
  ])
})

test('a PR the CLI could not link is tried again next time', async ($, on) => {
  const { clock, shell } = base(on)
  const runs: string[][] = []
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') return ran(128)
    runs.push([...e.argv])
    return runs.length === 1 ? ran(1, 'not logged in') : ran()
  })

  await bash($, shell, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  await bash($, shell, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()

  expect(runs).toEqual([
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
  ])
})

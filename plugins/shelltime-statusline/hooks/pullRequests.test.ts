import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { createdPullRequestUrls, extractPullRequestUrls, isPrCreateCommand } from './pullRequests'

const CLI = '/home/me/.shelltime/bin/shelltime'
const PR_1 = 'https://github.com/shelltime/cli/pull/318'
const PR_2 = 'https://github.com/shelltime/web/pull/77'

function ran(exitCode = 0, stderr = '') {
  return { value: { exitCode, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false } }
}

// Beneath the plugin: HOME, a clock, and no settings hooks to run.
function base(on: On) {
  mock.env(on, { HOME: '/home/me' })
  on('classic.PostToolUse', () => ({}))
  return mock.clock(on, { now: Date.UTC(2026, 9, 8, 12) })
}

// The world beneath the plugin, with every command it runs recorded; `missing`
// names executables that cannot start.
function world(on: On, missing: string[] = []) {
  const clock = base(on)
  const runs: string[][] = []
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    if (missing.includes(e.argv[0] ?? '')) throw new Error(`spawn ${e.argv[0]} ENOENT`)
    return ran()
  })
  return { clock, runs }
}

function bash($: Engine, command: string, stdout: string, session_id = 'sess-1') {
  return $.classic.PostToolUse({
    session_id,
    tool_name: 'Bash',
    tool_input: { command, description: 'Open a PR' },
    tool_response: { stdout, stderr: '', interrupted: false },
    tool_use_id: 'toolu_1',
  })
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

  expect(createdPullRequestUrls('Bash', { command: 'gh pr create' }, { stdout: `${PR_1}\n` })).toEqual([PR_1])
  expect(createdPullRequestUrls('Bash', { command: 'gh pr view 1' }, { stdout: `${PR_1}\n` })).toEqual([])
  expect(createdPullRequestUrls('Read', { command: 'gh pr create' }, { stdout: `${PR_1}\n` })).toEqual([])
  expect(createdPullRequestUrls('Bash', null, undefined)).toEqual([])
})

test('links every PR a gh pr create printed to the session, once', async ($, on) => {
  const { clock, runs } = world(on)

  await bash($, `gh pr create --fill && cd ../web && gh pr create --fill`, `${PR_1}\n${PR_2}\n`)
  await clock.settle()
  expect(runs).toEqual([[CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1, PR_2]])

  // The same PR printed again (say, by a retry) is not sent twice.
  await bash($, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  expect(runs).toHaveLength(1)

  // Another session that opens the same PR still gets it.
  await bash($, 'gh pr create --fill', `${PR_1}\n`, 'sess-2')
  await clock.settle()
  expect(runs[1]).toEqual([CLI, 'cc', 'pr', '--session-id', 'sess-2', PR_1])
})

test('leaves other commands and tools alone', async ($, on) => {
  const { clock, runs } = world(on)

  await bash($, `gh pr view ${PR_1}`, `${PR_1}\n`)
  await bash($, 'gh pr create --fill', 'no url here\n')
  await $.classic.PostToolUse({
    session_id: 'sess-1',
    tool_name: 'Read',
    tool_input: { file_path: '/work/notes.md' },
    tool_response: { stdout: `gh pr create ${PR_1}` },
    tool_use_id: 'toolu_2',
  })
  await clock.settle()

  expect(runs).toEqual([])
})

test('falls back to shelltime on PATH when ~/.shelltime/bin has none', async ($, on) => {
  const { clock, runs } = world(on, [CLI])

  await bash($, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  expect(runs).toEqual([
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
    ['shelltime', 'cc', 'pr', '--session-id', 'sess-1', PR_1],
  ])
})

test('a PR the CLI could not link is tried again next time', async ($, on) => {
  const clock = base(on)
  const runs: string[][] = []
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return runs.length === 1 ? ran(1, 'not logged in') : ran()
  })

  await bash($, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()
  await bash($, 'gh pr create --fill', `${PR_1}\n`)
  await clock.settle()

  expect(runs).toEqual([
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
    [CLI, 'cc', 'pr', '--session-id', 'sess-1', PR_1],
  ])
})

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { GitInfo, StatuslineView } from '../types'
import {
  checkOk,
  dailyStatsRequest,
  parseDailyStats,
  parseUserLogin,
  sessionProjectRequest,
  userProfileRequest,
} from './api'
import type { ApiRequest, ApiResponse } from './api'
import { BASE_FILES, LOCAL_FILES, formatOf, mergeConfig, parseShellTimeConfig, resolveConfig } from './config'
import type { ShellTimeConfig } from './config'
import { ccPrArgs, createdPullRequestUrls } from './pullRequests'
import { buildSegments, displayModelName } from './segments'
import { StatusRow } from './ui/desktop'
import { StatusLine } from './ui/terminal'

const view = atom({ plugin: 'shelltime-statusline', key: 'view' } as const, null)

// The native statusline redraws as the conversation changes, never on an
// idle timer; so does this one: at most one local refresh per DEBOUNCE_MS,
// and ShellTime's API at most once per REMOTE_INTERVAL_MS.
const DEBOUNCE_MS = 300
const REMOTE_INTERVAL_MS = 15_000

const EMPTY_VIEW: StatuslineView = {
  git: null,
  model: '',
  sessionCost: 0,
  daily: null,
  fiveHourPercent: null,
  sevenDayPercent: null,
  contextPercent: 0,
  login: '',
  webEndpoint: '',
  sessionId: '',
}

// The module's own bookkeeping; a reload starts it over, the view stays.
let localTimer: Timer | undefined
let remoteTimer: Timer | undefined
let isLocalRunning = false
let isLocalDirty = false
let isRemoteRunning = false
let lastRemoteAt = Number.NEGATIVE_INFINITY
let login = ''
let loginToken = ''
const sentProjects = new Set<string>()
const sentPullRequests = new Set<string>()
const loggedErrors = new Set<string>()

function logOnce($: EngineInterface, what: string, err: unknown) {
  const message = `${what} failed: ${err instanceof Error ? err.message : String(err)}`
  if (loggedErrors.has(message)) return
  loggedErrors.add(message)
  $.ui.log(`shelltime-statusline: ${message}`, { to: 'debug' })
}

function patch($: EngineInterface, fields: Partial<StatuslineView>) {
  return update($, view, current => ({ ...(current ?? EMPTY_VIEW), ...fields }))
}

async function send($: EngineInterface, request: ApiRequest): Promise<ApiResponse> {
  return $.http.fetch(request.url, request.init)
}

async function readConfigFile($: EngineInterface, dir: string, names: readonly string[]) {
  for (const name of names) {
    try {
      return parseShellTimeConfig(await $.fs.read(`${dir}/${name}`), formatOf(name))
    } catch {
      // not there: try the next name
    }
  }
  return {}
}

// The CLI's config, re-read on every remote refresh so `shelltime init` takes
// effect without a restart.
async function loadConfig($: EngineInterface): Promise<ShellTimeConfig> {
  const home = await $.env.get('HOME')
  if (home === undefined || home === '') return resolveConfig({})
  const dir = `${home}/.shelltime`
  const base = await readConfigFile($, dir, BASE_FILES)
  const local = await readConfigFile($, dir, LOCAL_FILES)
  return resolveConfig(mergeConfig(base, local))
}

// shelltime/cli daemon/git.go GetGitInfo: the same three git commands, with
// optional locks off so the statusline never contends with the person's git.
async function fetchGitInfo($: EngineInterface, cwd: string): Promise<GitInfo | null> {
  const init = { env: { GIT_OPTIONAL_LOCKS: '0' }, timeoutMs: 2000 }
  try {
    const repo = await $.process.run(['git', '-C', cwd, 'rev-parse', '--git-dir'], init)
    if (repo.exitCode !== 0) return null
    const head = await $.process.run(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], init)
    const status = await $.process.run(['git', '-C', cwd, 'status', '--porcelain'], init)
    return {
      branch: head.exitCode === 0 ? head.stdout.trim() : '',
      dirty: status.exitCode === 0 && status.stdout.trim() !== '',
    }
  } catch {
    return null
  }
}

async function sendSessionProject($: EngineInterface, config: ShellTimeConfig, sessionId: string, cwd: string) {
  const project = `${sessionId}\n${cwd}`
  if (sessionId === '' || cwd === '' || sentProjects.has(project)) return
  sentProjects.add(project)
  try {
    checkOk(await send($, sessionProjectRequest(config, sessionId, cwd)))
  } catch (err) {
    sentProjects.delete(project)
    logOnce($, 'session-project', err)
  }
}

// The CLI as install.bash lays it out, then whatever PATH has: a desktop host's
// PATH often lacks ~/.shelltime/bin.
async function runShelltime($: EngineInterface, args: readonly string[]) {
  const home = await $.env.get('HOME')
  const bins = home === undefined || home === '' ? ['shelltime'] : [`${home}/.shelltime/bin/shelltime`, 'shelltime']
  let notFound: unknown
  for (const bin of bins) {
    let ran
    try {
      ran = await $.process.run([bin, ...args], { timeoutMs: 10_000 })
    } catch (err) {
      // not there (or hung): try the next one
      notFound = err
      continue
    }
    if (ran.exitCode !== 0) {
      throw new Error(`shelltime exited with ${ran.exitCode}: ${ran.stderr.trim()}`)
    }
    return
  }
  throw notFound
}

// Links PRs opened by `gh pr create` to the session: `shelltime cc pr` hands
// them to the daemon, which sends them to ShellTime.
async function linkPullRequests($: EngineInterface, sessionId: string, urls: readonly string[]) {
  const fresh = urls.filter(url => !sentPullRequests.has(`${sessionId}\n${url}`))
  if (sessionId === '' || fresh.length === 0) return
  for (const url of fresh) sentPullRequests.add(`${sessionId}\n${url}`)
  try {
    await runShelltime($, ccPrArgs(sessionId, fresh))
  } catch (err) {
    for (const url of fresh) sentPullRequests.delete(`${sessionId}\n${url}`)
    logOnce($, 'pull-request link', err)
  }
}

// Daily cost, agent time and login from ShellTime's API.
async function refreshRemote($: EngineInterface, sessionId: string, cwd: string) {
  if (isRemoteRunning) return
  const now = await $.clock.now()
  const wait = lastRemoteAt + REMOTE_INTERVAL_MS - now
  if (wait > 0) {
    remoteTimer ??= $.clock.after(wait, () => {
      remoteTimer = undefined
      void refreshRemote($, sessionId, cwd)
    })
    return
  }
  isRemoteRunning = true
  lastRemoteAt = now
  try {
    const config = await loadConfig($)
    if (config.token === '') {
      await patch($, { daily: null, login: '', webEndpoint: '' })
      return
    }

    void sendSessionProject($, config, sessionId, cwd)

    if (login === '' || loginToken !== config.token) {
      try {
        login = parseUserLogin(await send($, userProfileRequest(config)))
        loginToken = config.token
      } catch (err) {
        logOnce($, 'user profile', err)
      }
    }

    let daily: StatuslineView['daily'] | undefined
    try {
      daily = parseDailyStats(await send($, dailyStatsRequest(config, now)))
    } catch (err) {
      logOnce($, 'daily stats', err)
    }

    await patch($, {
      ...(daily === undefined ? {} : { daily }),
      login: loginToken === config.token ? login : '',
      webEndpoint: config.webEndpoint,
    })
  } catch (err) {
    logOnce($, 'remote refresh', err)
  } finally {
    isRemoteRunning = false
  }
}

// What the engine already knows (cost, context, rate limits, model) and git.
async function refreshLocal($: EngineInterface) {
  if (isLocalRunning) {
    isLocalDirty = true
    return
  }
  isLocalRunning = true
  try {
    do {
      isLocalDirty = false
      const [usage, model, sessionId, cwd] = await Promise.all([
        $.session.usage(),
        $.session.model(),
        $.session.id(),
        $.session.cwd(),
      ])
      const percentOf = (kind: string) =>
        usage.rateLimits.find(limit => limit.kind === kind)?.percentUsed ?? null
      const git = await fetchGitInfo($, cwd)
      await patch($, {
        git,
        model: displayModelName(model),
        sessionCost: usage.cost?.usd ?? 0,
        contextPercent: usage.context.percent ?? 0,
        fiveHourPercent: percentOf('five_hour'),
        sevenDayPercent: percentOf('seven_day'),
        sessionId,
      })
      void refreshRemote($, sessionId, cwd)
    } while (isLocalDirty)
  } catch (err) {
    logOnce($, 'refresh', err)
  } finally {
    isLocalRunning = false
  }
}

function schedule($: EngineInterface) {
  localTimer ??= $.clock.after(DEBOUNCE_MS, () => {
    localTimer = undefined
    void refreshLocal($)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    schedule($)
    return started
  })

  on('prompt.submit', ($, e, next) => {
    schedule($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    schedule($)
    return result
  })

  on('classic.PostToolUse', async ($, e, next) => {
    const result = await next(e)
    // In the background: the hook never holds up or changes the tool's result.
    void linkPullRequests($, e.session_id, createdPullRequestUrls(e.tool_name, e.tool_input, e.tool_response))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    schedule($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (current === null || e.props.hasSurvey) {
      return next(e)
    }

    // The terminal keeps the CLI's line; graphical surfaces draw a flat row.
    const segments = buildSegments(current)
    return e.surface === 'terminal' ? (
      <StatusLine ui={$.ui.resolve(e)} segments={segments} />
    ) : (
      <StatusRow ui={$.ui.resolve(e)} segments={segments} />
    )
  })
}

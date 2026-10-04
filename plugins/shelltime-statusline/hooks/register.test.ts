import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'shelltime-statusline'
const SURFACES = ['terminal', 'desktop'] as const
const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 160,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

function json(data: unknown) {
  return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ data }) } }
}

function ran(stdout: string, exitCode = 0) {
  return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
}

// The world beneath the plugin: a session in a dirty git checkout on `main`,
// and the CLI's config holding `token` when one is given.
function world(on: On, token?: string) {
  mock.env(on, { HOME: '/home/me' })
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 4, 12) })

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 84_000, window: 200_000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 23 },
        { kind: 'seven_day', percentUsed: 45 },
      ],
      cost: { usd: 1.234 },
    },
  }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: '/work/app' }))

  const gitCalls: string[] = []
  on('process.run', ($, e) => {
    const args = e.argv.slice(3).join(' ')
    gitCalls.push(args)
    if (args === 'rev-parse --git-dir') return ran('.git\n')
    if (args === 'rev-parse --abbrev-ref HEAD') return ran('main\n')
    return ran(' M README.md\n')
  })

  on('fs.read', ($, e) =>
    token !== undefined && e.path === '/home/me/.shelltime/config.yaml'
      ? { value: `token: ${token}\nwebEndpoint: https://shelltime.xyz\n` }
      : { deny: 'ENOENT' },
  )

  const requests: { url: string; body: string; auth: string | undefined }[] = []
  on('http.fetch', ($, e) => {
    const body = e.init?.body ?? ''
    requests.push({ url: e.url, body, auth: e.init?.headers?.Authorization })
    if (e.url.endsWith('/api/v1/cc/session-project')) return { value: { status: 204, ok: true, headers: {}, text: '' } }
    if (body.includes('fetchCurrentUserProfile')) return json({ fetchUser: { login: 'annatarhe' } })
    return json({ fetchUser: { aiCodeOtel: { analytics: { totalCostUsd: 12.5, totalSessionSeconds: 3900 } } } })
  })

  return { clock, gitCalls, requests }
}

function mountBand($: Engine, surface: (typeof SURFACES)[number], props = PROPS) {
  return $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props })
}

const SESSION_URL = 'https://shelltime.xyz/users/annatarhe/coding-agent/session/sess-1'
const DAILY_URL = 'https://shelltime.xyz/users/annatarhe/coding-agent/claude-code'
const USAGE_URL = 'https://claude.ai/settings/usage'
const PROFILE_URL = 'https://shelltime.xyz/users/annatarhe'

test('draws the full statusline, with links, on terminal and desktop', async ($, on) => {
  const { clock, gitCalls, requests } = world(on, 'tok-123')

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await clock.advance(300)
  await clock.settle()

  expect(gitCalls).toEqual(['rev-parse --git-dir', 'rev-parse --abbrev-ref HEAD', 'status --porcelain'])
  expect(requests.map(r => r.url).sort()).toEqual([
    'https://api.shelltime.xyz/api/v1/cc/session-project',
    'https://api.shelltime.xyz/api/v2/graphql',
    'https://api.shelltime.xyz/api/v2/graphql',
  ])
  expect(requests.every(r => r.auth === 'CLI tok-123')).toBe(true)
  expect(requests.find(r => r.url.endsWith('session-project'))?.body).toBe(
    JSON.stringify({ sessionId: 'sess-1', projectPath: '/work/app' }),
  )

  const terminal = await mountBand($, 'terminal')
  for (const text of ['🌿 main*', '🤖 Opus 5.5', '💰 $1.23', '📊 $12.50', '🚦 5h:23% 7d:45%', '⏱️ 1h5m', '📈 42%']) {
    expect(await terminal.find({ type: 'Text', text }), text).toBeDefined()
  }
  expect((await terminal.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([
    SESSION_URL,
    DAILY_URL,
    USAGE_URL,
    PROFILE_URL,
  ])
  await terminal.unmount()

  const desktop = await mountBand($, 'desktop')
  for (const key of ['git', 'sessionCost', 'dailyCost', 'quota', 'agentTime', 'context']) {
    expect(await desktop.find({ key: `pill-${key}` }), key).toBeDefined()
  }
  expect(await desktop.find({ key: 'pill-model' })).toBeUndefined()
  expect(await desktop.find({ type: 'Text', text: 'Opus 5.5' })).toBeUndefined()
  for (const text of ['main*', '$1.23', '$12.50', '1h5m', '23%', '45%', '42%']) {
    expect(await desktop.find({ type: 'Text', text }), text).toBeDefined()
  }
  expect((await desktop.findAll({ type: 'Svg' })).map(svg => svg.props.alt)).toEqual([
    '5-hour quota used: 23%',
    '7-day quota used: 45%',
    'Context window used: 42%',
  ])
  expect((await desktop.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([
    SESSION_URL,
    DAILY_URL,
    USAGE_URL,
    USAGE_URL,
    PROFILE_URL,
  ])
  await desktop.unmount()
})

test('without a ShellTime token: local figures only, no API calls', async ($, on) => {
  const { clock, requests } = world(on)

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await clock.advance(300)
  await clock.settle()

  expect(requests).toHaveLength(0)

  const terminal = await mountBand($, 'terminal')
  for (const text of ['💰 $1.23', '📊 -', '⏱️ -']) {
    expect(await terminal.find({ type: 'Text', text }), text).toBeDefined()
  }
  expect((await terminal.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([USAGE_URL])
  await terminal.unmount()

  const desktop = await mountBand($, 'desktop')
  expect(await desktop.find({ type: 'Text', text: '$1.23' })).toBeDefined()
  expect((await desktop.find({ key: 'pill-dailyCost' }))?.text).toBe('📊-')
  expect((await desktop.find({ key: 'pill-agentTime' }))?.text).toBe('⏱️-')
  expect((await desktop.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([USAGE_URL, USAGE_URL])
  await desktop.unmount()
})

test('the API is asked at most once per 15 seconds', async ($, on) => {
  const { clock, requests } = world(on, 'tok-123')

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await clock.advance(300)
  await clock.settle()
  const first = requests.length

  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } }).catch(() => undefined)
  await clock.advance(300)
  await clock.settle()
  expect(requests.length).toBe(first)

  await clock.advance(15_000)
  await clock.settle()
  expect(requests.filter(r => r.body.includes('fetchAICodeOtelAnalytics'))).toHaveLength(2)
})

test('yields the band to a survey', async ($, on) => {
  const { clock } = world(on, 'tok-123')
  // The engine's own band: the survey.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: 'survey' }))

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await clock.advance(300)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, { ...PROPS, hasSurvey: true })
    expect(await ui.find({ key: 'shelltime-statusline' }), surface).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'survey' }), surface).toBeDefined()
    await ui.unmount()
  }
})

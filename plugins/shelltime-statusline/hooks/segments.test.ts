// Mirrors the formatting cases of shelltime/cli commands/cc_statusline_test.go.
import { describe, expect, test } from 'claude-code/testing'

import type { StatuslineView } from '../types'
import { dailyStatsRequest, parseDailyStats, rfc3339, startOfLocalDay } from './api'
import { mergeConfig, parseShellTimeConfig, resolveConfig } from './config'
import {
  CLAUDE_USAGE_URL,
  buildSegments,
  displayModelName,
  formatDuration,
  formatPlain,
  quotaSegment,
  segmentText,
} from './segments'

const VIEW: StatuslineView = {
  git: { branch: 'main', dirty: false },
  model: 'Opus 5.5',
  sessionCost: 1.234,
  daily: { costUsd: 12.5, sessionSeconds: 3900 },
  fiveHourPercent: 23,
  sevenDayPercent: 45,
  contextPercent: 42,
  login: 'annatarhe',
  webEndpoint: 'https://shelltime.xyz',
  sessionId: 'sess-1',
}

function segment(view: StatuslineView, key: string) {
  return buildSegments(view).find(s => s.key === key)
}

describe('buildSegments', () => {
  test('draws every segment in the Go order', () => {
    expect(formatPlain(buildSegments(VIEW))).toBe(
      '🌿 main | 🤖 Opus 5.5 | 💰 $1.23 | 📊 $12.50 | 🚦 5h:23% 7d:45% | ⏱️ 1h5m | 📈 42%',
    )
  })

  test('git: dirty gets a star, no repo or no branch is a gray dash', () => {
    expect(segment({ ...VIEW, git: { branch: 'main', dirty: true } }, 'git')).toEqual({
      key: 'git',
      icon: '🌿',
      value: 'main*',
      color: 'green',
    })
    expect(segment({ ...VIEW, git: null }, 'git')).toEqual({ key: 'git', icon: '🌿', value: '-', color: 'gray' })
    expect(segment({ ...VIEW, git: { branch: '', dirty: false } }, 'git')?.value).toBe('-')
  })

  test('links need the login, the web endpoint and (for the session) its id', () => {
    expect(segment(VIEW, 'sessionCost')?.url).toBe(
      'https://shelltime.xyz/users/annatarhe/coding-agent/session/sess-1',
    )
    expect(segment(VIEW, 'dailyCost')?.url).toBe('https://shelltime.xyz/users/annatarhe/coding-agent/claude-code')
    expect(segment(VIEW, 'agentTime')?.url).toBe('https://shelltime.xyz/users/annatarhe')
    expect(segment({ ...VIEW, sessionId: '' }, 'sessionCost')?.url).toBeUndefined()
    for (const key of ['sessionCost', 'dailyCost', 'agentTime']) {
      expect(segment({ ...VIEW, login: '' }, key)?.url).toBeUndefined()
      expect(segment({ ...VIEW, webEndpoint: '' }, key)?.url).toBeUndefined()
    }
  })

  test('no daily stats: daily cost and agent time are gray dashes', () => {
    expect(segment({ ...VIEW, daily: null }, 'dailyCost')).toEqual({
      key: 'dailyCost',
      icon: '📊',
      value: '-',
      color: 'gray',
    })
    expect(segment({ ...VIEW, daily: null }, 'agentTime')).toEqual({
      key: 'agentTime',
      icon: '⏱️',
      value: '-',
      color: 'gray',
    })
    expect(segment({ ...VIEW, daily: { costUsd: 0, sessionSeconds: 0 } }, 'dailyCost')?.value).toBe('-')
  })

  test('context: green below 50, yellow from 50, red from 80, with a meter', () => {
    expect(segment({ ...VIEW, contextPercent: 49.4 }, 'context')).toEqual({
      key: 'context',
      icon: '📈',
      value: '49%',
      color: 'green',
      meters: [{ percent: 49.4, description: 'Context window used' }],
    })
    expect(segment({ ...VIEW, contextPercent: 50 }, 'context')?.color).toBe('yellow')
    expect(segment({ ...VIEW, contextPercent: 80 }, 'context')?.color).toBe('red')
  })

  test('the model has no color', () => {
    expect(segment(VIEW, 'model')).toEqual({ key: 'model', icon: '🤖', value: 'Opus 5.5' })
  })

  test('segmentText is the icon and the value', () => {
    expect(buildSegments(VIEW).map(segmentText)).toEqual([
      '🌿 main',
      '🤖 Opus 5.5',
      '💰 $1.23',
      '📊 $12.50',
      '🚦 5h:23% 7d:45%',
      '⏱️ 1h5m',
      '📈 42%',
    ])
  })
})

describe('quotaSegment', () => {
  test('either bucket missing is a gray dash, still linked', () => {
    expect(quotaSegment(null, null)).toEqual({
      key: 'quota',
      icon: '🚦',
      value: '-',
      color: 'gray',
      url: CLAUDE_USAGE_URL,
    })
    expect(quotaSegment(null, 45).value).toBe('-')
    expect(quotaSegment(null, 45).meters).toBeUndefined()
  })

  test('colored by the higher bucket', () => {
    expect(quotaSegment(23, 45).color).toBe('green')
    expect(quotaSegment(55, 10).color).toBe('yellow')
    expect(quotaSegment(10, 85).color).toBe('red')
    expect(quotaSegment(23.4, 45.6).value).toBe('5h:23% 7d:46%')
  })

  test('one meter per bucket, unrounded', () => {
    expect(quotaSegment(23.4, 45.6).meters).toEqual([
      { label: '5h', percent: 23.4, description: '5-hour quota used' },
      { label: '7d', percent: 45.6, description: '7-day quota used' },
    ])
  })
})

describe('formatDuration', () => {
  test('hours and minutes, minutes and seconds, seconds', () => {
    expect(formatDuration(3900)).toBe('1h5m')
    expect(formatDuration(123)).toBe('2m3s')
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(0)).toBe('0s')
  })
})

describe('displayModelName', () => {
  test('model ids read as the native statusline names them', () => {
    expect(displayModelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(displayModelName('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5')
    expect(displayModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(displayModelName('claude-opus-4-6[1m]')).toBe('Opus 4.6 (1M context)')
    expect(displayModelName('claude-fable-5-1')).toBe('Fable 5.1')
  })

  test('anything else is shown as given', () => {
    expect(displayModelName('Opus 5.5')).toBe('Opus 5.5')
    expect(displayModelName('my-gateway-model')).toBe('my-gateway-model')
  })
})

describe('config', () => {
  test('YAML: top-level keys only, quotes and comments stripped', () => {
    const yaml = [
      '# ShellTime',
      'token: "tok-yaml" # mine',
      "apiEndpoint: 'https://api.example.com/'",
      'webEndpoint: https://web.example.com',
      'codeTracking:',
      '  token: nested-token',
      '  apiEndpoint: https://nested.example.com',
    ].join('\n')
    expect(parseShellTimeConfig(yaml, 'yaml')).toEqual({
      token: 'tok-yaml',
      apiEndpoint: 'https://api.example.com/',
      webEndpoint: 'https://web.example.com',
    })
  })

  test('TOML: keys before the first table, case-insensitive', () => {
    const toml = ['Token = "tok-toml"', 'APIEndpoint = "https://api.example.com"', '', '[codeTracking]', 'token = "nested"'].join(
      '\n',
    )
    expect(parseShellTimeConfig(toml, 'toml')).toEqual({ token: 'tok-toml', apiEndpoint: 'https://api.example.com' })
  })

  test('local overrides base where set', () => {
    expect(mergeConfig({ token: 'base', apiEndpoint: 'https://a' }, { token: 'local', apiEndpoint: '' })).toEqual({
      token: 'local',
      apiEndpoint: 'https://a',
    })
  })

  test('defaults: API endpoint, and a web endpoint that is no URL is reset', () => {
    expect(resolveConfig({})).toEqual({
      token: '',
      apiEndpoint: 'https://api.shelltime.xyz',
      webEndpoint: 'https://shelltime.xyz',
    })
    expect(resolveConfig({ webEndpoint: 'shelltime.xyz', apiEndpoint: 'https://api.example.com/' })).toEqual({
      token: '',
      apiEndpoint: 'https://api.example.com',
      webEndpoint: 'https://shelltime.xyz',
    })
  })
})

describe('api', () => {
  test('daily stats ask for today in UTC, as the daemon does', () => {
    const now = Date.UTC(2026, 9, 4, 12, 30, 15, 123)
    const request = dailyStatsRequest(
      { token: 'tok', apiEndpoint: 'https://api.shelltime.xyz', webEndpoint: 'https://shelltime.xyz' },
      now,
    )
    expect(request.url).toBe('https://api.shelltime.xyz/api/v2/graphql')
    expect(request.init.headers.Authorization).toBe('CLI tok')
    const body = JSON.parse(request.init.body) as { variables: { filter: Record<string, string> } }
    expect(body.variables.filter).toEqual({
      since: rfc3339(startOfLocalDay(now)),
      until: '2026-10-04T12:30:15Z',
      clientType: 'claude_code',
    })
  })

  test('daily stats parse, and GraphQL errors throw', () => {
    const text = JSON.stringify({
      data: { fetchUser: { aiCodeOtel: { analytics: { totalCostUsd: 3.5, totalSessionSeconds: 60 } } } },
    })
    expect(parseDailyStats({ ok: true, status: 200, text })).toEqual({ costUsd: 3.5, sessionSeconds: 60 })
    expect(() =>
      parseDailyStats({ ok: true, status: 200, text: JSON.stringify({ errors: [{ message: 'nope' }] }) }),
    ).toThrow('GraphQL error: nope')
    expect(() => parseDailyStats({ ok: false, status: 401, text: '' })).toThrow('HTTP error: 401')
  })
})

// The statusline's segments, mirroring `formatStatuslineOutput` in
// shelltime/cli commands/cc_statusline.go: same order, icons, colors,
// thresholds and links.
import type { StatuslineView } from '../types'

export type SegmentColor = 'green' | 'cyan' | 'yellow' | 'red' | 'magenta' | 'gray'

export type Segment = {
  key: 'git' | 'model' | 'sessionCost' | 'dailyCost' | 'quota' | 'agentTime' | 'context'
  text: string
  color?: SegmentColor
  url?: string
}

export const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage'

export const SEPARATOR = ' | '

// Same buckets as the Go statusline: red from 80%, yellow from 50%.
export function thresholdColor(percent: number): SegmentColor {
  if (percent >= 80) return 'red'
  if (percent >= 50) return 'yellow'
  return 'green'
}

// formatSessionDuration: "1h5m", "2m3s", "45s".
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h${m}m`
  if (m > 0) return `${m}m${s}s`
  return `${s}s`
}

const MODEL_ID = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i

// Turns a model id into the name the native statusline shows
// (`claude-opus-5-5` → `Opus 5.5`); anything else is shown as given.
export function displayModelName(model: string): string {
  const trimmed = model.trim()
  const match = MODEL_ID.exec(trimmed)
  if (match === null) return trimmed
  const [, family = '', major = '', minor, longContext] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1).toLowerCase()
  const version = minor === undefined ? major : `${major}.${minor}`
  return `${name} ${version}${longContext === undefined ? '' : ' (1M context)'}`
}

export function quotaSegment(fiveHour: number | null, sevenDay: number | null): Segment {
  if (fiveHour === null || sevenDay === null) {
    return { key: 'quota', text: '🚦 -', color: 'gray', url: CLAUDE_USAGE_URL }
  }
  return {
    key: 'quota',
    text: `🚦 5h:${Math.round(fiveHour)}% 7d:${Math.round(sevenDay)}%`,
    color: thresholdColor(Math.max(fiveHour, sevenDay)),
    url: CLAUDE_USAGE_URL,
  }
}

export function buildSegments(v: StatuslineView): Segment[] {
  const hasProfile = v.login !== '' && v.webEndpoint !== ''
  const profileUrl = `${v.webEndpoint}/users/${v.login}`
  const segments: Segment[] = []

  // Git info first (green)
  if (v.git !== null && v.git.branch !== '') {
    segments.push({ key: 'git', text: `🌿 ${v.git.branch}${v.git.dirty ? '*' : ''}`, color: 'green' })
  } else {
    segments.push({ key: 'git', text: '🌿 -', color: 'gray' })
  }

  // Model name
  segments.push({ key: 'model', text: `🤖 ${v.model}` })

  // Session cost (cyan), linked to the session page
  segments.push({
    key: 'sessionCost',
    text: `💰 $${v.sessionCost.toFixed(2)}`,
    color: 'cyan',
    url: hasProfile && v.sessionId !== '' ? `${profileUrl}/coding-agent/session/${v.sessionId}` : undefined,
  })

  // Daily cost (yellow), linked to the coding agent page
  if (v.daily !== null && v.daily.costUsd > 0) {
    segments.push({
      key: 'dailyCost',
      text: `📊 $${v.daily.costUsd.toFixed(2)}`,
      color: 'yellow',
      url: hasProfile ? `${profileUrl}/coding-agent/claude-code` : undefined,
    })
  } else {
    segments.push({ key: 'dailyCost', text: '📊 -', color: 'gray' })
  }

  // Quota utilization, linked to claude.ai usage
  segments.push(quotaSegment(v.fiveHourPercent, v.sevenDayPercent))

  // AI agent time (magenta), linked to the user profile
  if (v.daily !== null && v.daily.sessionSeconds > 0) {
    segments.push({
      key: 'agentTime',
      text: `⏱️ ${formatDuration(v.daily.sessionSeconds)}`,
      color: 'magenta',
      url: hasProfile ? profileUrl : undefined,
    })
  } else {
    segments.push({ key: 'agentTime', text: '⏱️ -', color: 'gray' })
  }

  // Context percentage with color coding
  segments.push({
    key: 'context',
    text: `📈 ${Math.round(v.contextPercent)}%`,
    color: thresholdColor(v.contextPercent),
  })

  return segments
}

// The whole line as plain text, as the Go statusline prints it without colors.
export function formatPlain(segments: readonly Segment[]): string {
  return segments.map(s => s.text).join(SEPARATOR)
}

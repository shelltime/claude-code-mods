// The statusline's segments, mirroring `formatStatuslineOutput` in
// shelltime/cli commands/cc_statusline.go: same order, icons, colors,
// thresholds and links. Surface-agnostic: hooks/ui draws them.
import type { StatuslineView } from '../types'

export type SegmentColor = 'green' | 'cyan' | 'yellow' | 'red' | 'magenta' | 'gray'

// The colors a percentage takes.
export type ThresholdColor = Extract<SegmentColor, 'green' | 'yellow' | 'red'>

export type SegmentKey = 'git' | 'model' | 'sessionCost' | 'dailyCost' | 'quota' | 'agentTime' | 'context'

// A percentage a graphical surface draws as a bar beside its figure.
export type Meter = {
  label?: string
  percent: number
  description: string
}

export type Segment = {
  key: SegmentKey
  icon: string
  value: string
  color?: SegmentColor
  url?: string
  meters?: readonly Meter[]
}

export const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage'

export const SEPARATOR = ' | '

// Same buckets as the Go statusline: red from 80%, yellow from 50%.
export function thresholdColor(percent: number): ThresholdColor {
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

// The segment as the Go statusline prints it: icon, space, value.
export function segmentText(segment: Segment): string {
  return `${segment.icon} ${segment.value}`
}

// A figure with nothing to show yet: a gray dash.
function missing(key: SegmentKey, icon: string, url?: string): Segment {
  return { key, icon, value: '-', color: 'gray', url }
}

export function quotaSegment(fiveHour: number | null, sevenDay: number | null): Segment {
  if (fiveHour === null || sevenDay === null) {
    return missing('quota', '🚦', CLAUDE_USAGE_URL)
  }
  return {
    key: 'quota',
    icon: '🚦',
    value: `5h:${Math.round(fiveHour)}% 7d:${Math.round(sevenDay)}%`,
    color: thresholdColor(Math.max(fiveHour, sevenDay)),
    url: CLAUDE_USAGE_URL,
    meters: [
      { label: '5h', percent: fiveHour, description: '5-hour quota used' },
      { label: '7d', percent: sevenDay, description: '7-day quota used' },
    ],
  }
}

export function buildSegments(v: StatuslineView): Segment[] {
  const hasProfile = v.login !== '' && v.webEndpoint !== ''
  const profileUrl = `${v.webEndpoint}/users/${v.login}`
  const segments: Segment[] = []

  // Git info first (green)
  if (v.git !== null && v.git.branch !== '') {
    segments.push({ key: 'git', icon: '🌿', value: `${v.git.branch}${v.git.dirty ? '*' : ''}`, color: 'green' })
  } else {
    segments.push(missing('git', '🌿'))
  }

  // Model name
  segments.push({ key: 'model', icon: '🤖', value: v.model })

  // Session cost (cyan), linked to the session page
  segments.push({
    key: 'sessionCost',
    icon: '💰',
    value: `$${v.sessionCost.toFixed(2)}`,
    color: 'cyan',
    url: hasProfile && v.sessionId !== '' ? `${profileUrl}/coding-agent/session/${v.sessionId}` : undefined,
  })

  // Daily cost (yellow), linked to the coding agent page
  if (v.daily !== null && v.daily.costUsd > 0) {
    segments.push({
      key: 'dailyCost',
      icon: '📊',
      value: `$${v.daily.costUsd.toFixed(2)}`,
      color: 'yellow',
      url: hasProfile ? `${profileUrl}/coding-agent/claude-code` : undefined,
    })
  } else {
    segments.push(missing('dailyCost', '📊'))
  }

  // Quota utilization, linked to claude.ai usage
  segments.push(quotaSegment(v.fiveHourPercent, v.sevenDayPercent))

  // AI agent time (magenta), linked to the user profile
  if (v.daily !== null && v.daily.sessionSeconds > 0) {
    segments.push({
      key: 'agentTime',
      icon: '⏱️',
      value: formatDuration(v.daily.sessionSeconds),
      color: 'magenta',
      url: hasProfile ? profileUrl : undefined,
    })
  } else {
    segments.push(missing('agentTime', '⏱️'))
  }

  // Context percentage with color coding
  segments.push({
    key: 'context',
    icon: '📈',
    value: `${Math.round(v.contextPercent)}%`,
    color: thresholdColor(v.contextPercent),
    meters: [{ percent: v.contextPercent, description: 'Context window used' }],
  })

  return segments
}

// The whole line as plain text, as the Go statusline prints it without colors.
export function formatPlain(segments: readonly Segment[]): string {
  return segments.map(segmentText).join(SEPARATOR)
}

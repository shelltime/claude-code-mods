export type GitInfo = { branch: string; dirty: boolean }

export type DailyStats = { costUsd: number; sessionSeconds: number }

export type StatuslineView = {
  git: GitInfo | null
  model: string
  sessionCost: number
  daily: DailyStats | null
  fiveHourPercent: number | null
  sevenDayPercent: number | null
  contextPercent: number
  login: string
  webEndpoint: string
  sessionId: string
}

declare module 'claude-code' {
  interface PluginState {
    'shelltime-statusline': { view: StatuslineView | null }
  }
}

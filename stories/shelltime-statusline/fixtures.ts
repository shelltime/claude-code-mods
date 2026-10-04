// The states the statusline draws, from a full ShellTime account to a
// session with nothing but local figures.
import type { StatuslineView } from '../../plugins/shelltime-statusline/types'

const FULL: StatuslineView = {
  git: { branch: 'main', dirty: true },
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

export const VIEWS = {
  // Signed in, in a dirty checkout, every figure in.
  full: FULL,
  // No `shelltime init` yet: no daily figures, no links but claude.ai's.
  noToken: { ...FULL, daily: null, login: '', webEndpoint: '' },
  // Close to the limits: quota and context past the thresholds.
  highUsage: { ...FULL, fiveHourPercent: 85, sevenDayPercent: 62, contextPercent: 91, sessionCost: 18.4 },
  // Outside a repo, before the rate limits are known.
  noGit: { ...FULL, git: null, fiveHourPercent: null, sevenDayPercent: null },
  // A long branch name.
  longBranch: { ...FULL, git: { branch: 'feat/statusline-clean-ui-with-storybook', dirty: false } },
} satisfies Record<string, StatuslineView>

export type ViewName = keyof typeof VIEWS

// The requests the Go statusline and its daemon send to ShellTime's API, built
// and parsed here; register.tsx sends them over $.http.fetch.
import type { DailyStats } from '../types'
import type { ShellTimeConfig } from './config'

export const USER_AGENT = 'shelltimeClaudeCodeMod@0.1.0'

// shelltime/cli model/cc_statusline_types.go CCStatuslineDailyCostQuery
export const DAILY_STATS_QUERY = `query fetchAICodeOtelAnalytics($filter: AICodeAnalyticsFilter!) {
	fetchUser {
		aiCodeOtel {
			analytics(filter: $filter) {
				totalCostUsd
				totalSessionSeconds
			}
		}
	}
}`

// shelltime/cli model/user_profile_service.go FetchCurrentUserProfileQuery
export const USER_PROFILE_QUERY = `query fetchCurrentUserProfile {
	fetchUser {
		login
	}
}`

export type ApiRequest = {
  url: string
  init: { method: string; headers: Record<string, string>; body: string }
}

export type ApiResponse = { ok: boolean; status: number; text: string }

function post(config: ShellTimeConfig, path: string, payload: unknown): ApiRequest {
  return {
    url: `${config.apiEndpoint}${path}`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Authorization: `CLI ${config.token}`,
      },
      body: JSON.stringify(payload),
    },
  }
}

// RFC 3339 in UTC without milliseconds, as Go's time.RFC3339 writes it.
export function rfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// Local midnight of the day `now` falls on: the daemon's "today" range.
export function startOfLocalDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dailyStatsRequest(config: ShellTimeConfig, now: number): ApiRequest {
  return post(config, '/api/v2/graphql', {
    query: DAILY_STATS_QUERY,
    variables: {
      filter: { since: rfc3339(startOfLocalDay(now)), until: rfc3339(now), clientType: 'claude_code' },
    },
  })
}

export function userProfileRequest(config: ShellTimeConfig): ApiRequest {
  return post(config, '/api/v2/graphql', { query: USER_PROFILE_QUERY })
}

// shelltime/cli model/api_session_project.go SendSessionProjectUpdate
export function sessionProjectRequest(
  config: ShellTimeConfig,
  sessionId: string,
  projectPath: string,
): ApiRequest {
  return post(config, '/api/v1/cc/session-project', { sessionId, projectPath })
}

function graphqlData<T>(res: ApiResponse): T {
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`)
  const body = JSON.parse(res.text) as { data?: T; errors?: { message: string }[] }
  const [first] = body.errors ?? []
  if (first !== undefined) throw new Error(`GraphQL error: ${first.message}`)
  if (body.data === undefined || body.data === null) throw new Error('GraphQL error: no data')
  return body.data
}

export function parseDailyStats(res: ApiResponse): DailyStats {
  type Data = {
    fetchUser: { aiCodeOtel: { analytics: { totalCostUsd: number; totalSessionSeconds: number } } }
  }
  const { totalCostUsd, totalSessionSeconds } = graphqlData<Data>(res).fetchUser.aiCodeOtel.analytics
  return { costUsd: totalCostUsd, sessionSeconds: totalSessionSeconds }
}

export function parseUserLogin(res: ApiResponse): string {
  return graphqlData<{ fetchUser: { login: string } }>(res).fetchUser.login
}

export function checkOk(res: ApiResponse): void {
  if (!res.ok && res.status !== 204) throw new Error(`HTTP error: ${res.status}`)
}

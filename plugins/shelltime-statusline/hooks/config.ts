// The ShellTime CLI's own config file (~/.shelltime/config.*), the one
// `shelltime init` writes, so the CLI and this mod share a single config.
// Discovery and merge mirror shelltime/cli model/config.go; register.tsx
// reads the files.
export type ShellTimeConfig = {
  token: string
  apiEndpoint: string
  webEndpoint: string
}

export type ConfigFormat = 'yaml' | 'toml'

export const DEFAULT_API_ENDPOINT = 'https://api.shelltime.xyz'
export const DEFAULT_WEB_ENDPOINT = 'https://shelltime.xyz'

// findConfigFiles: the first existing base file and the first existing local
// file, YAML before TOML; the local file overrides the base.
export const BASE_FILES = ['config.yaml', 'config.yml', 'config.toml'] as const
export const LOCAL_FILES = ['config.local.yaml', 'config.local.yml', 'config.local.toml'] as const

const KEYS: Record<string, keyof ShellTimeConfig> = {
  token: 'token',
  apiendpoint: 'apiEndpoint',
  webendpoint: 'webEndpoint',
}

export function formatOf(fileName: string): ConfigFormat {
  return /\.ya?ml$/i.test(fileName) ? 'yaml' : 'toml'
}

function unquote(raw: string): string {
  const value = raw.trim()
  const quote = value.charAt(0)
  if (quote === '"' || quote === "'") {
    const end = value.indexOf(quote, 1)
    if (end > 0) {
      const inner = value.slice(1, end)
      return quote === '"' ? inner.replace(/\\(["\\])/g, '$1') : inner
    }
  }
  // An unquoted value ends at a comment.
  return value.replace(/\s+#.*$/, '').trim()
}

// Only the three top-level keys the statusline needs are read. Nested keys
// (an indented YAML key, a TOML key under a [table]) are other features'
// settings, such as codeTracking's own token, and are skipped.
export function parseShellTimeConfig(text: string, format: ConfigFormat): Partial<ShellTimeConfig> {
  const config: Partial<ShellTimeConfig> = {}
  for (const line of text.split(/\r?\n/)) {
    if (format === 'toml') {
      const trimmed = line.trim()
      if (trimmed.startsWith('[')) break
      const match = /^"?([A-Za-z_][\w-]*)"?\s*=\s*(.*)$/.exec(trimmed)
      const key = match === null ? undefined : KEYS[(match[1] ?? '').toLowerCase()]
      if (match !== null && key !== undefined) config[key] = unquote(match[2] ?? '')
      continue
    }
    if (/^\s/.test(line) || line.startsWith('#')) continue
    const match = /^"?([A-Za-z_][\w-]*)"?\s*:\s*(.*)$/.exec(line)
    const key = match === null ? undefined : KEYS[(match[1] ?? '').toLowerCase()]
    if (match !== null && key !== undefined) config[key] = unquote(match[2] ?? '')
  }
  return config
}

// mergeConfig: a non-empty local value overrides the base.
export function mergeConfig(
  base: Partial<ShellTimeConfig>,
  local: Partial<ShellTimeConfig>,
): Partial<ShellTimeConfig> {
  const merged = { ...base }
  for (const key of ['token', 'apiEndpoint', 'webEndpoint'] as const) {
    const value = local[key]
    if (value !== undefined && value !== '') merged[key] = value
  }
  return merged
}

export function resolveConfig(partial: Partial<ShellTimeConfig>): ShellTimeConfig {
  const apiEndpoint = partial.apiEndpoint || DEFAULT_API_ENDPOINT
  const webEndpoint = partial.webEndpoint ?? ''
  return {
    token: partial.token ?? '',
    apiEndpoint: apiEndpoint.replace(/\/+$/, ''),
    webEndpoint: (webEndpoint.startsWith('http') ? webEndpoint : DEFAULT_WEB_ENDPOINT).replace(/\/+$/, ''),
  }
}

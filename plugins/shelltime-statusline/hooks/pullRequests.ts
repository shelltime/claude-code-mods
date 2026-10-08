// Pull requests a Bash call opened with `gh pr create`, linked to the session
// through `shelltime cc pr` (shelltime/cli commands/cc_pr.go), which hands them
// to the daemon.

const PR_CREATE = /\bgh\s+pr\s+create\b/
const PR_URL = /https?:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+\/pull\/\d+/g

export function isPrCreateCommand(command: string): boolean {
  return PR_CREATE.test(command)
}

// `gh pr create` prints the new PR's URL on stdout; a command chaining several
// prints one each. Distinct URLs, in the order they were printed.
export function extractPullRequestUrls(stdout: string): string[] {
  return [...new Set(stdout.match(PR_URL) ?? [])]
}

function stringField(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null) return ''
  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' ? field : ''
}

// The URLs a PostToolUse event's Bash call printed when it ran `gh pr create`;
// none for any other tool or command. stdout only: `gh` reports an existing PR
// for the branch on stderr, and that one wasn't opened here.
export function createdPullRequestUrls(toolName: string, toolInput: unknown, toolResponse: unknown): string[] {
  if (toolName !== 'Bash' || !isPrCreateCommand(stringField(toolInput, 'command'))) return []
  return extractPullRequestUrls(stringField(toolResponse, 'stdout'))
}

export function ccPrArgs(sessionId: string, urls: readonly string[]): string[] {
  return ['cc', 'pr', '--session-id', sessionId, ...urls]
}

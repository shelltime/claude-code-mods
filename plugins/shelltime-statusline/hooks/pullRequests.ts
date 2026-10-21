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

// The URLs a Bash call printed when it ran `gh pr create`; none for any other
// command. stdout only: `gh` reports an existing PR for the branch on stderr,
// and that one wasn't opened here.
export function createdPullRequestUrls(command: string, stdout: string): string[] {
  if (!isPrCreateCommand(command)) return []
  return extractPullRequestUrls(stdout)
}

export function ccPrArgs(sessionId: string, urls: readonly string[]): string[] {
  return ['cc', 'pr', '--session-id', sessionId, ...urls]
}

import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const SESSION_END_URL = 'https://api.shelltime.xyz/api/v1/cc/session-end'

type Sent = { url: string; body: string; auth: string | undefined }

// The world beneath the plugin: the engine's end step, the CLI's config holding
// `token` when one is given, and ShellTime's API answering `answer`.
function world(on: On, token?: string, answer: () => unknown = () => ({ status: 204, ok: true, headers: {}, text: '' })) {
  mock.env(on, { HOME: '/home/me' })
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('fs.read', ($, e) =>
    token !== undefined && e.path === '/home/me/.shelltime/config.yaml'
      ? { value: `token: ${token}\n` }
      : { deny: 'ENOENT' },
  )
  const requests: Sent[] = []
  on('http.fetch', ($, e) => {
    requests.push({ url: e.url, body: e.init?.body ?? '', auth: e.init?.headers?.Authorization })
    return { value: answer() }
  })
  return { requests }
}

test('tells ShellTime the session ended, for every reason', async ($, on) => {
  const { requests } = world(on, 'tok-123')

  for (const reason of ['prompt_input_exit', 'clear', 'resume', 'logout', 'other'] as const) {
    const ended = await $.session.end({ reason, sessionId: `sess-${reason}`, resume: { id: `sess-${reason}` } })
    expect(ended).toEqual({ sessionId: `sess-${reason}` })
  }

  expect(requests).toEqual(
    ['prompt_input_exit', 'clear', 'resume', 'logout', 'other'].map(reason => ({
      url: SESSION_END_URL,
      body: JSON.stringify({ sessionId: `sess-${reason}`, reason }),
      auth: 'CLI tok-123',
    })),
  )
})

test('without a ShellTime token: nothing is sent', async ($, on) => {
  const { requests } = world(on)

  const ended = await $.session.end({ reason: 'other', sessionId: 'sess-1', resume: { id: 'sess-1' } })

  expect(ended).toEqual({ sessionId: 'sess-1' })
  expect(requests).toEqual([])
})

test('a failed report never holds up or fails the exit', async ($, on) => {
  const { requests } = world(on, 'tok-123', () => {
    throw new Error('connect ECONNREFUSED')
  })
  expect(await $.session.end({ reason: 'other', sessionId: 'sess-1', resume: { id: 'sess-1' } })).toEqual({
    sessionId: 'sess-1',
  })
  expect(requests).toHaveLength(1)
})

test('a server error never fails the exit', async ($, on) => {
  const { requests } = world(on, 'tok-123', () => ({ status: 500, ok: false, headers: {}, text: '' }))
  expect(await $.session.end({ reason: 'other', sessionId: 'sess-1', resume: { id: 'sess-1' } })).toEqual({
    sessionId: 'sess-1',
  })
  expect(requests).toHaveLength(1)
})

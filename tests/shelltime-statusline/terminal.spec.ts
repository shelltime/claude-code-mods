import { describe, expect, test } from 'vitest'

import { buildSegments, formatPlain } from '../../plugins/shelltime-statusline/hooks/segments'
import { StatusLine } from '../../plugins/shelltime-statusline/hooks/ui/terminal'
import type { StatuslineView } from '../../plugins/shelltime-statusline/types'
import { VIEWS } from '../../stories/shelltime-statusline/fixtures'
import { elementsFor, h } from '../../tooling/engine/runtime'
import type { RenderElement } from '../../tooling/engine/runtime'
import { ofType, textOf } from '../../tooling/engine/tree'

function draw(view: StatuslineView): RenderElement {
  return h(StatusLine as never, { ui: elementsFor('terminal'), segments: buildSegments(view) }) as RenderElement
}

function textProps(view: StatuslineView, text: string) {
  return ofType(draw(view), 'Text').find(t => textOf(t) === text)?.props
}

describe('terminal line', () => {
  test('the same text as `shelltime cc statusline`', () => {
    expect(textOf(draw(VIEWS.full))).toBe(
      '🌿 main* | 🤖 Opus 5.5 | 💰 $1.23 | 📊 $12.50 | 🚦 5h:23% 7d:45% | ⏱️ 1h5m | 📈 42%',
    )
    for (const view of Object.values(VIEWS)) {
      expect(textOf(draw(view))).toBe(formatPlain(buildSegments(view)))
    }
  })

  test("colors are Claude Code's theme keys", () => {
    expect(textProps(VIEWS.full, '🌿 main*')).toEqual({ color: 'success' })
    expect(textProps(VIEWS.full, '🤖 Opus 5.5')).toEqual({})
    expect(textProps(VIEWS.full, '💰 $1.23')).toEqual({ color: 'planMode' })
    expect(textProps(VIEWS.full, '📊 $12.50')).toEqual({ color: 'warning' })
    expect(textProps(VIEWS.full, '🚦 5h:23% 7d:45%')).toEqual({ color: 'success' })
    expect(textProps(VIEWS.full, '⏱️ 1h5m')).toEqual({ color: 'merged' })
    expect(textProps(VIEWS.full, '📈 42%')).toEqual({ color: 'success' })
    expect(textProps(VIEWS.highUsage, '🚦 5h:85% 7d:62%')).toEqual({ color: 'error' })
    expect(textProps(VIEWS.highUsage, '📈 91%')).toEqual({ color: 'error' })
  })

  test('placeholders and separators are dim', () => {
    expect(textProps(VIEWS.noToken, '📊 -')).toEqual({ dimColor: true })
    expect(textProps(VIEWS.noGit, '🌿 -')).toEqual({ dimColor: true })
    const separators = ofType(draw(VIEWS.full), 'Text').filter(t => textOf(t) === ' | ')
    expect(separators).toHaveLength(6)
    expect(separators.every(t => t.props.dimColor === true)).toBe(true)
  })

  test('linked segments, in order', () => {
    expect(ofType(draw(VIEWS.full), 'Link').map(link => link.props.href)).toEqual([
      'https://shelltime.xyz/users/annatarhe/coding-agent/session/sess-1',
      'https://shelltime.xyz/users/annatarhe/coding-agent/claude-code',
      'https://claude.ai/settings/usage',
      'https://shelltime.xyz/users/annatarhe',
    ])
    expect(ofType(draw(VIEWS.noToken), 'Link').map(link => link.props.href)).toEqual([
      'https://claude.ai/settings/usage',
    ])
  })
})

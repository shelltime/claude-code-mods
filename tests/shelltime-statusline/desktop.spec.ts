import { describe, expect, test } from 'vitest'

import { buildSegments } from '../../plugins/shelltime-statusline/hooks/segments'
import { DESKTOP_TONES, StatusRow, meterSvg } from '../../plugins/shelltime-statusline/hooks/ui/desktop'
import type { StatuslineView } from '../../plugins/shelltime-statusline/types'
import { VIEWS } from '../../stories/shelltime-statusline/fixtures'
import { elementsFor, h } from '../../tooling/engine/runtime'
import type { RenderElement } from '../../tooling/engine/runtime'
import { findAll, findByKey, ofType, textOf } from '../../tooling/engine/tree'

function draw(view: StatuslineView): RenderElement {
  return h(StatusRow as never, { ui: elementsFor('desktop'), segments: buildSegments(view) }) as RenderElement
}

function segment(view: StatuslineView, key: string): RenderElement {
  const found = findByKey(draw(view), `segment-${key}`)
  if (found === undefined) throw new Error(`no segment-${key}`)
  return found
}

function textProps(within: RenderElement, text: string) {
  return ofType(within, 'Text').find(t => textOf(t) === text)?.props
}

describe('desktop row', () => {
  test('flat: no Box has a border or padding', () => {
    for (const view of Object.values(VIEWS)) {
      for (const box of ofType(draw(view), 'Box')) {
        expect(Object.keys(box.props).filter(prop => /^(border|padding)/.test(prop))).toEqual([])
      }
    }
  })

  test('one keyed segment per figure, in the Go order, without the model', () => {
    const tree = draw(VIEWS.full)
    const keys = findAll(tree, e => String(e.props.key).startsWith('segment-')).map(e => e.props.key)
    expect(keys).toEqual([
      'segment-git',
      'segment-sessionCost',
      'segment-dailyCost',
      'segment-quota',
      'segment-agentTime',
      'segment-context',
    ])
    expect(textOf(tree)).not.toContain('Opus')
  })

  test('each segment is its icon and its figure', () => {
    expect(textOf(segment(VIEWS.full, 'git'))).toBe('🌿main*')
    expect(textOf(segment(VIEWS.full, 'sessionCost'))).toBe('💰$1.23')
    expect(textOf(segment(VIEWS.full, 'quota'))).toBe('🚦5h23%7d45%')
    expect(textOf(segment(VIEWS.full, 'context'))).toBe('📈42%')
  })

  test('regular weight throughout', () => {
    expect(ofType(draw(VIEWS.full), 'Text').filter(t => t.props.bold === true)).toEqual([])
  })

  test('figures in their tones; placeholders in the surface dim', () => {
    expect(textProps(segment(VIEWS.full, 'git'), 'main*')).toEqual({ color: DESKTOP_TONES.green })
    expect(textProps(segment(VIEWS.full, 'sessionCost'), '$1.23')).toEqual({ color: DESKTOP_TONES.cyan })
    expect(textProps(segment(VIEWS.full, 'dailyCost'), '$12.50')).toEqual({ color: DESKTOP_TONES.yellow })
    expect(textProps(segment(VIEWS.full, 'agentTime'), '1h5m')).toEqual({ color: DESKTOP_TONES.magenta })
    expect(textProps(segment(VIEWS.noToken, 'dailyCost'), '-')).toEqual({ dimColor: true })
    expect(textProps(segment(VIEWS.noGit, 'git'), '-')).toEqual({ dimColor: true })
  })

  test('linked figures underline under the pointer, inside their own segment', () => {
    const tree = draw(VIEWS.full)
    const hovering = ofType(tree, 'Text').filter(t => t.hover !== undefined)
    expect(hovering.map(textOf)).toEqual(['$1.23', '$12.50', '23%', '45%', '1h5m'])
    expect(hovering.every(t => t.hover?.underline === true)).toBe(true)
    expect(ofType(tree, 'Link').map(link => link.props.href)).toEqual([
      'https://shelltime.xyz/users/annatarhe/coding-agent/session/sess-1',
      'https://shelltime.xyz/users/annatarhe/coding-agent/claude-code',
      'https://claude.ai/settings/usage',
      'https://claude.ai/settings/usage',
      'https://shelltime.xyz/users/annatarhe',
    ])
  })

  test('a bar per percentage, described for readers that cannot see it', () => {
    expect(ofType(draw(VIEWS.full), 'Svg').map(svg => svg.props.alt)).toEqual([
      '5-hour quota used: 23%',
      '7-day quota used: 45%',
      'Context window used: 42%',
    ])
    expect(ofType(draw(VIEWS.noGit), 'Svg').map(svg => svg.props.alt)).toEqual(['Context window used: 42%'])
  })

  test.each([
    [49, 'green'],
    [50, 'yellow'],
    [79, 'yellow'],
    [80, 'red'],
  ] as const)('context at %i%% is %s, bar and figure alike', (percent, tone) => {
    const context = segment({ ...VIEWS.full, contextPercent: percent }, 'context')
    expect(ofType(context, 'Svg')[0]?.props.source).toContain(`fill="${DESKTOP_TONES[tone]}"`)
    expect(textProps(context, `${percent}%`)).toEqual({ color: DESKTOP_TONES[tone] })
  })
})

describe('meterSvg', () => {
  const fillWidth = (svg: string) => /<rect width="(\d+)" height="4" rx="2" fill="#[0-9a-f]{6}"\/>/.exec(svg)?.[1]

  test('a thin 28×4 track', () => {
    expect(meterSvg(0, DESKTOP_TONES.green)).toContain('width="28" height="4" viewBox="0 0 28 4"')
  })

  test('fills its share of the track in the given color', () => {
    const svg = meterSvg(50, DESKTOP_TONES.yellow)
    expect(fillWidth(svg)).toBe('14')
    expect(svg).toContain(`fill="${DESKTOP_TONES.yellow}"`)
  })

  test('clamped to the track; any use at all shows at least a dot', () => {
    expect(fillWidth(meterSvg(150, DESKTOP_TONES.red))).toBe('28')
    expect(fillWidth(meterSvg(1, DESKTOP_TONES.green))).toBe('4')
    expect(fillWidth(meterSvg(0, DESKTOP_TONES.green))).toBeUndefined()
    expect(fillWidth(meterSvg(-5, DESKTOP_TONES.green))).toBeUndefined()
  })
})

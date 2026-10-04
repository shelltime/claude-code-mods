// @vitest-environment jsdom
// Every story draws through the preview harness: a surface, its figures and
// no element the harness cannot paint.
import { composeStories } from '@storybook/react-vite'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import preview from '../../.storybook/preview'
import * as desktop from '../../stories/shelltime-statusline/Desktop.stories'
import * as overview from '../../stories/shelltime-statusline/Overview.stories'
import * as terminal from '../../stories/shelltime-statusline/Terminal.stories'

afterEach(cleanup)

const FILES = { desktop, terminal, overview }

for (const [file, stories] of Object.entries(FILES)) {
  describe(file, () => {
    for (const [name, Story] of Object.entries(composeStories(stories, preview))) {
      test(name, () => {
        const { container } = render(<Story />)
        const surfaces = container.querySelectorAll('[data-surface]')
        expect(surfaces.length).toBeGreaterThan(0)
        for (const surface of surfaces) {
          expect(surface.textContent).toMatch(/\$\d+\.\d\d/)
          expect(surface.textContent).toMatch(/\d+%/)
          expect(surface.textContent).not.toMatch(/<\w+>/)
        }
      })
    }
  })
}

test('the desktop draws no border and a bar per percentage', () => {
  const { Full } = composeStories(desktop, preview)
  const { container } = render(<Full />)
  const boxes = [...container.querySelectorAll<HTMLElement>('[data-type="Box"]')]
  expect(boxes.some(box => box.style.border !== '')).toBe(false)
  expect([...container.querySelectorAll('img')].map(img => img.getAttribute('alt'))).toEqual([
    '5-hour quota used: 23%',
    '7-day quota used: 45%',
    'Context window used: 42%',
  ])
})

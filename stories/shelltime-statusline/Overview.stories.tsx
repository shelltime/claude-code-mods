import type { Meta, StoryObj } from '@storybook/react-vite'

import type { Theme } from '../../tooling/engine/Surface'
import type { SurfaceName } from '../../tooling/engine/runtime'
import { VIEWS } from './fixtures'
import type { ViewName } from './fixtures'
import { StatuslinePreview } from './StatuslinePreview'

const SURFACES: readonly SurfaceName[] = ['desktop', 'terminal']
const THEMES: readonly Theme[] = ['light', 'dark']

// Every surface in both themes, for one state: the side-by-side check.
function Overview({ view }: { view: ViewName }) {
  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
      {SURFACES.flatMap(surface =>
        THEMES.map(theme => (
          <figure key={`${surface}-${theme}`} style={{ margin: 0, display: 'grid', gap: 6 }}>
            <figcaption style={{ opacity: 0.6 }}>{`${surface} · ${theme}`}</figcaption>
            <StatuslinePreview surface={surface} theme={theme} view={view} />
          </figure>
        )),
      )}
    </div>
  )
}

const meta = {
  title: 'shelltime-statusline/Overview',
  component: Overview,
  args: { view: 'full' },
  argTypes: { view: { control: 'select', options: Object.keys(VIEWS) } },
} satisfies Meta<typeof Overview>

export default meta
type Story = StoryObj<typeof meta>

export const SideBySide: Story = {}

export const HighUsage: Story = { args: { view: 'highUsage' } }

import type { Meta, StoryObj } from '@storybook/react-vite'

import { VIEWS } from './fixtures'
import { StatuslinePreview } from './StatuslinePreview'

const meta = {
  title: 'shelltime-statusline/Desktop',
  component: StatuslinePreview,
  args: { surface: 'desktop', view: 'full' },
  argTypes: {
    surface: { table: { disable: true } },
    view: { control: 'select', options: Object.keys(VIEWS) },
    columns: { control: { type: 'range', min: 30, max: 160 } },
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
  },
} satisfies Meta<typeof StatuslinePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {}

export const NoToken: Story = { args: { view: 'noToken' } }

export const HighUsage: Story = { args: { view: 'highUsage' } }

export const NoGit: Story = { args: { view: 'noGit' } }

// A docked pane leaves the band narrow: segments wrap whole.
export const Narrow: Story = { args: { view: 'longBranch', columns: 48 } }

import type { Meta, StoryObj } from '@storybook/react-vite'

import { VIEWS } from './fixtures'
import { StatuslinePreview } from './StatuslinePreview'

const meta = {
  title: 'shelltime-statusline/Terminal',
  component: StatuslinePreview,
  args: { surface: 'terminal', view: 'full' },
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

// Narrower than the line: it wraps between segments.
export const Narrow: Story = { args: { view: 'longBranch', columns: 60 } }

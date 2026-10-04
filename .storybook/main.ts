import type { StorybookConfig } from '@storybook/react-vite'

import { hooksJsx } from '../tooling/engine/hooks-jsx.ts'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.tsx'],
  core: { disableTelemetry: true },
  viteFinal: config => ({ ...config, plugins: [hooksJsx(), ...(config.plugins ?? [])] }),
}

export default config

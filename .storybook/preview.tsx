import type { Preview } from '@storybook/react-vite'

import { ThemeContext } from '../tooling/engine/Surface'
import type { Theme } from '../tooling/engine/Surface'
import { installRuntime } from '../tooling/engine/runtime'

installRuntime()

// The page around the stories: Claude's warm neutrals.
const PAGE: Record<Theme, { background: string; color: string }> = {
  light: { background: '#f0eee6', color: '#3d3d3a' },
  dark: { background: '#1f1e1d', color: '#c2c0b6' },
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Light or dark surface',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'dark' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme ?? 'dark') as Theme
      return (
        <ThemeContext.Provider value={theme}>
          <div style={{ ...PAGE[theme], padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
            <Story />
          </div>
        </ThemeContext.Provider>
      )
    },
  ],
}

export default preview

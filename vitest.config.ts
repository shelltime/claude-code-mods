import { defineConfig } from 'vitest/config'

import { hooksJsx } from './tooling/engine/hooks-jsx.ts'

export default defineConfig({
  plugins: [hooksJsx()],
  test: {
    // The plugins' own `*.test.ts` run in the engine, under `claude plugin test`.
    include: ['tests/**/*.spec.{ts,tsx}'],
    setupFiles: ['tooling/engine/setup.ts'],
    environment: 'node',
  },
})

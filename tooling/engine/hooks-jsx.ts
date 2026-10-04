// A mod's hooks modules compile JSX to bare `h(...)` / `Fragment` calls, the
// engine's runtime; everything else here (stories, specs) is React's. This
// compiles the former first, so nothing after it sees JSX in them.
import { transformWithOxc } from 'vite'
import type { Plugin } from 'vite'

const HOOKS_MODULE = /\/plugins\/[^/]+\/hooks\/.+\.tsx$/

export function hooksJsx(): Plugin {
  return {
    name: 'claude-code-hooks-jsx',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0] ?? id
      if (!HOOKS_MODULE.test(file)) return null
      const result = await transformWithOxc(code, file, {
        lang: 'tsx',
        jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' },
      })
      return { code: result.code, map: result.map }
    },
  }
}

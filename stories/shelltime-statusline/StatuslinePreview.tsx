// The band as the mod draws it above the prompt, on one surface.
import { buildSegments } from '../../plugins/shelltime-statusline/hooks/segments'
import { StatusRow } from '../../plugins/shelltime-statusline/hooks/ui/desktop'
import { StatusLine } from '../../plugins/shelltime-statusline/hooks/ui/terminal'
import { Surface } from '../../tooling/engine/Surface'
import type { Theme } from '../../tooling/engine/Surface'
import { elementsFor, h } from '../../tooling/engine/runtime'
import type { SurfaceName } from '../../tooling/engine/runtime'
import { VIEWS } from './fixtures'
import type { ViewName } from './fixtures'

export type StatuslinePreviewProps = {
  surface: SurfaceName
  view: ViewName
  theme?: Theme
  // The band's width in cells.
  columns?: number
}

export function drawStatusline(surface: SurfaceName, view: ViewName) {
  const segments = buildSegments(VIEWS[view])
  return surface === 'terminal'
    ? h(StatusLine as never, { ui: elementsFor('terminal'), segments })
    : h(StatusRow as never, { ui: elementsFor('desktop'), segments })
}

export function StatuslinePreview({ surface, view, theme, columns }: StatuslinePreviewProps) {
  return <Surface surface={surface} theme={theme} columns={columns} tree={drawStatusline(surface, view)} />
}

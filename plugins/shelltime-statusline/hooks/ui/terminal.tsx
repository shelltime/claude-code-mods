// The terminal's drawing: the CLI's own line, `🌿 main | 🤖 Opus 5.5 | …`,
// in its ANSI colors, wrapping between segments.
import type { TextProps } from 'claude-code'

import { SEPARATOR, segmentText } from '../segments'
import type { Segment, SegmentColor } from '../segments'
import { LinkedText } from './common'
import type { BaseElements } from './common'

// Gray is the terminal's dim, which follows its theme; no color is the default.
function toneStyle(color: SegmentColor | undefined): TextProps {
  if (color === undefined) return {}
  return color === 'gray' ? { dimColor: true } : { color }
}

export function StatusLine({ ui, segments }: { ui: BaseElements; segments: readonly Segment[] }) {
  const { Box, Text } = ui
  const children = segments.flatMap((segment, i) => {
    const drawn = <LinkedText ui={ui} text={segmentText(segment)} url={segment.url} style={toneStyle(segment.color)} />
    return i === 0 ? [drawn] : [<Text dimColor>{SEPARATOR}</Text>, drawn]
  })

  return (
    <Box key="shelltime-statusline" flexDirection="row" flexWrap="wrap">
      {children}
    </Box>
  )
}

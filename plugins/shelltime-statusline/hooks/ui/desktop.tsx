// The desktop's drawing: one flat row, no borders or padding, each segment
// its icon and figure in a tone that reads on the band's light and dark
// backgrounds, and a thin bar beside each percentage.
import type { ElementTable, TextProps } from 'claude-code'

import { thresholdColor } from '../segments'
import type { Meter, Segment, SegmentColor, SegmentKey } from '../segments'
import { LinkedText } from './common'

export type GraphicalElements = Pick<ElementTable<'desktop'>, 'Box' | 'Text' | 'Link' | 'Svg'>

// The composer's footer already names the model.
export const HIDDEN_ON_DESKTOP: readonly SegmentKey[] = ['model']

// The terminal's ANSI names as Claude-palette mid tones with contrast on
// either theme; gray stays the surface's own dim. A figure and its bar share one.
export const DESKTOP_TONES: Record<Exclude<SegmentColor, 'gray'>, string> = {
  green: '#3f9b57',
  cyan: '#3e8fb0',
  yellow: '#b88016',
  red: '#d1454f',
  magenta: '#9b6bd3',
}

const METER_WIDTH = 28
const METER_HEIGHT = 4

function toneStyle(color: SegmentColor | undefined): TextProps {
  if (color === undefined) return {}
  return color === 'gray' ? { dimColor: true } : { color: DESKTOP_TONES[color] }
}

// A rounded track, filled to `percent` (clamped to 0–100) in `color`, any
// use at all at least a dot; the track's translucent gray sits on either theme.
export function meterSvg(percent: number, color: string): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const fill = clamped === 0 ? 0 : Math.max(METER_HEIGHT, Math.round((clamped / 100) * METER_WIDTH))
  const radius = METER_HEIGHT / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${METER_WIDTH}" height="${METER_HEIGHT}" viewBox="0 0 ${METER_WIDTH} ${METER_HEIGHT}">`,
    `<rect width="${METER_WIDTH}" height="${METER_HEIGHT}" rx="${radius}" fill="#808080" fill-opacity="0.25"/>`,
    fill > 0 ? `<rect width="${fill}" height="${METER_HEIGHT}" rx="${radius}" fill="${color}"/>` : '',
    '</svg>',
  ].join('')
}

type FigureProps = { ui: GraphicalElements; url?: string }

// In the segment's tone, underlined under the pointer when it links.
function figureStyle(color: SegmentColor | undefined, url: string | undefined): TextProps {
  return url === undefined ? toneStyle(color) : { ...toneStyle(color), hover: { underline: true } }
}

// `5h ━━── 23%`: the label, the bar and the figure, in the meter's own
// threshold color.
function MeterBar({ ui, url, meter }: FigureProps & { meter: Meter }) {
  const { Box, Svg, Text } = ui
  const percent = Math.round(meter.percent)
  const color = thresholdColor(meter.percent)
  return (
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      {meter.label === undefined ? null : <Text dimColor>{meter.label}</Text>}
      <Svg
        source={meterSvg(meter.percent, DESKTOP_TONES[color])}
        alt={`${meter.description}: ${percent}%`}
        width={METER_WIDTH}
        height={METER_HEIGHT}
      />
      <LinkedText ui={ui} text={`${percent}%`} url={url} style={figureStyle(color, url)} />
    </Box>
  )
}

// The figure a segment shows: its bars when it has percentages, else its value.
function Figure({ ui, url, segment }: FigureProps & { segment: Segment }) {
  const { Box } = ui
  if (segment.meters === undefined) {
    return <LinkedText ui={ui} text={segment.value} url={url} style={figureStyle(segment.color, url)} />
  }
  return (
    <Box flexDirection="row" alignItems="center" columnGap={2}>
      {segment.meters.map(meter => (
        <MeterBar ui={ui} url={url} meter={meter} />
      ))}
    </Box>
  )
}

// One segment: its icon and figure, keyed so a hover underlines its link alone.
function SegmentItem({ ui, segment }: { ui: GraphicalElements; segment: Segment }) {
  const { Box, Text } = ui
  return (
    <Box key={`segment-${segment.key}`} flexDirection="row" alignItems="center" columnGap={1}>
      <Text>{segment.icon}</Text>
      <Figure ui={ui} url={segment.url} segment={segment} />
    </Box>
  )
}

export function StatusRow({ ui, segments }: { ui: GraphicalElements; segments: readonly Segment[] }) {
  const { Box } = ui
  const shown = segments.filter(segment => !HIDDEN_ON_DESKTOP.includes(segment.key))
  return (
    <Box key="shelltime-statusline" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2}>
      {shown.map(segment => (
        <SegmentItem ui={ui} segment={segment} />
      ))}
    </Box>
  )
}

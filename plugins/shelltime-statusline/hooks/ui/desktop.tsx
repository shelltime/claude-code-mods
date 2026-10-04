// The desktop's drawing: one rounded pill per segment, its figure in a tone
// that reads on the band's light and dark backgrounds, and a bar beside each
// percentage.
import type { ElementTable, TextProps } from 'claude-code'

import { thresholdColor } from '../segments'
import type { Meter, Segment, SegmentColor, SegmentKey } from '../segments'
import { LinkedText } from './common'

export type GraphicalElements = Pick<ElementTable<'desktop'>, 'Box' | 'Text' | 'Link' | 'Svg'>

// The composer's footer already names the model.
export const HIDDEN_ON_DESKTOP: readonly SegmentKey[] = ['model']

// The terminal's ANSI names as mid tones with contrast on either theme;
// gray stays the surface's own dim.
export const DESKTOP_TONES: Record<Exclude<SegmentColor, 'gray'>, string> = {
  green: '#16a34a',
  cyan: '#0891b2',
  yellow: '#d97706',
  red: '#dc2626',
  magenta: '#c026d3',
}

const METER_WIDTH = 32
const METER_HEIGHT = 6

function toneOf(color: SegmentColor | undefined): string | undefined {
  return color === undefined || color === 'gray' ? undefined : DESKTOP_TONES[color]
}

function toneStyle(color: SegmentColor | undefined): TextProps {
  if (color === 'gray') return { dimColor: true }
  return { color: toneOf(color) }
}

// A rounded track, filled to `percent` (clamped to 0–100) in `color`, any
// use at all at least a dot; the track's translucent gray sits on either theme.
export function meterSvg(percent: number, color: string): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const fill = clamped === 0 ? 0 : Math.max(METER_HEIGHT, Math.round((clamped / 100) * METER_WIDTH))
  const radius = METER_HEIGHT / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${METER_WIDTH}" height="${METER_HEIGHT}" viewBox="0 0 ${METER_WIDTH} ${METER_HEIGHT}">`,
    `<rect width="${METER_WIDTH}" height="${METER_HEIGHT}" rx="${radius}" fill="#808080" fill-opacity="0.3"/>`,
    fill > 0 ? `<rect width="${fill}" height="${METER_HEIGHT}" rx="${radius}" fill="${color}"/>` : '',
    '</svg>',
  ].join('')
}

type FigureProps = { ui: GraphicalElements; url?: string }

// Bold, in the segment's tone, underlined under the pointer when it links.
function figureStyle(color: SegmentColor | undefined, url: string | undefined): TextProps {
  return { ...toneStyle(color), bold: true, hover: url === undefined ? undefined : { underline: true } }
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

// The figure a pill shows: its bars when it has percentages, else its value.
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

// One segment in a rounded border of its tone, brightening under the pointer.
function Pill({ ui, segment }: { ui: GraphicalElements; segment: Segment }) {
  const { Box, Text } = ui
  return (
    <Box
      key={`pill-${segment.key}`}
      flexDirection="row"
      alignItems="center"
      columnGap={1}
      paddingX={1}
      borderStyle="round"
      borderColor={toneOf(segment.color)}
      borderDimColor
      hover={{ borderDimColor: false }}
    >
      <Text>{segment.icon}</Text>
      <Figure ui={ui} url={segment.url} segment={segment} />
    </Box>
  )
}

export function StatusPills({ ui, segments }: { ui: GraphicalElements; segments: readonly Segment[] }) {
  const { Box } = ui
  const shown = segments.filter(segment => !HIDDEN_ON_DESKTOP.includes(segment.key))
  return (
    <Box key="shelltime-statusline" flexDirection="row" flexWrap="wrap" columnGap={1}>
      {shown.map(segment => (
        <Pill ui={ui} segment={segment} />
      ))}
    </Box>
  )
}

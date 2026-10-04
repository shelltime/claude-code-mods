// What both drawings of the statusline share.
import type { ElementTable, TextProps } from 'claude-code'

// The elements every surface that raises the band draws with.
export type BaseElements = Pick<ElementTable, 'Box' | 'Text' | 'Link'>

type LinkedTextProps = {
  ui: BaseElements
  text: string
  url?: string
  style?: TextProps
}

// One styled run of text, as a link when it has somewhere to go.
export function LinkedText({ ui, text, url, style }: LinkedTextProps) {
  const { Link, Text } = ui
  const label = <Text {...style}>{text}</Text>
  return url === undefined ? label : <Link href={url}>{label}</Link>
}

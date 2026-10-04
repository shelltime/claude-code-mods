// An approximate paint of a plain-data tree (runtime.ts) for previews: the
// terminal as a monospace grid, the desktop as the app's sans-serif band, each
// in light or dark. Cells are `ch` wide and one line tall. It is a preview,
// not the surfaces' renderers; `claude plugin test` checks what they accept.
import { createContext, useContext, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import type { Props, RenderElement, RenderNode, SurfaceName } from './runtime'

export type Theme = 'light' | 'dark'

// The theme Storybook's toolbar picks, for a Surface given none.
export const ThemeContext = createContext<Theme>('dark')

const LINE_HEIGHT = 1.5

// Claude Code's theme colors by key, as its light and dark themes draw them.
const THEME_KEYS: Record<Theme, Record<string, string>> = {
  light: {
    claude: 'rgb(215,119,87)',
    success: 'rgb(44,122,57)',
    warning: 'rgb(150,108,30)',
    error: 'rgb(171,43,63)',
    planMode: 'rgb(0,102,102)',
    merged: 'rgb(135,0,255)',
    inactive: 'rgb(102,102,102)',
    subtle: 'rgb(175,175,175)',
    text: 'rgb(0,0,0)',
  },
  dark: {
    claude: 'rgb(215,119,87)',
    success: 'rgb(78,186,101)',
    warning: 'rgb(255,193,7)',
    error: 'rgb(255,107,128)',
    planMode: 'rgb(72,150,140)',
    merged: 'rgb(175,135,255)',
    inactive: 'rgb(153,153,153)',
    subtle: 'rgb(80,80,80)',
    text: 'rgb(255,255,255)',
  },
}

type Chrome = { background: string; color: string; dim: string; fontFamily: string }

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'

// What each surface draws on: the terminal's default colors, the Claude
// desktop app's warm neutrals.
const CHROME: Record<SurfaceName, Record<Theme, Chrome>> = {
  terminal: {
    light: { background: '#ffffff', color: '#1f1f1f', dim: '#8a8a8a', fontFamily: MONO },
    dark: { background: '#1a1a1a', color: '#e6e6e6', dim: '#7c7c7c', fontFamily: MONO },
  },
  desktop: {
    light: { background: '#faf9f5', color: '#141413', dim: '#87867f', fontFamily: SANS },
    dark: { background: '#262624', color: '#f5f4ed', dim: '#9c9a92', fontFamily: SANS },
  },
}

type Paint = { surface: SurfaceName; theme: Theme; chrome: Chrome }

const PaintContext = createContext<Paint | null>(null)
// Whether the nearest keyed Box is under the pointer.
const HoverContext = createContext(false)

function usePaint(): Paint {
  const paint = useContext(PaintContext)
  if (paint === null) throw new Error('drawn outside a <Surface>')
  return paint
}

function colorOf(paint: Paint, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return THEME_KEYS[paint.theme][value] ?? value
}

const columns = (n: unknown) => (typeof n === 'number' ? `${n}ch` : typeof n === 'string' ? n : undefined)
const rows = (n: unknown) => (typeof n === 'number' ? `${n * LINE_HEIGHT}em` : typeof n === 'string' ? n : undefined)

// One side's spacing, from the most specific of Ink's props that is set.
function side(p: Props, prefix: 'margin' | 'padding', name: string, axis: 'X' | 'Y') {
  const value = p[`${prefix}${name}`] ?? p[`${prefix}${axis}`] ?? p[prefix]
  return axis === 'X' ? columns(value) : rows(value)
}

function boxStyle(paint: Paint, p: Props, hover: Props | undefined, isHovered: boolean): CSSProperties {
  const style: CSSProperties = {
    display: p.display === 'none' && !(isHovered && hover?.display === 'flex') ? 'none' : 'flex',
    flexDirection: (p.flexDirection as CSSProperties['flexDirection']) ?? 'row',
    flexWrap: p.flexWrap as CSSProperties['flexWrap'],
    alignItems: p.alignItems as CSSProperties['alignItems'],
    alignSelf: p.alignSelf as CSSProperties['alignSelf'],
    justifyContent: p.justifyContent as CSSProperties['justifyContent'],
    flexGrow: p.flexGrow as number | undefined,
    flexShrink: (p.flexShrink as number | undefined) ?? 1,
    columnGap: columns(p.columnGap ?? p.gap),
    rowGap: rows(p.rowGap ?? p.gap),
    width: columns(p.width),
    height: rows(p.height),
    minWidth: columns(p.minWidth),
    minHeight: rows(p.minHeight),
    marginTop: side(p, 'margin', 'Top', 'Y'),
    marginBottom: side(p, 'margin', 'Bottom', 'Y'),
    marginLeft: side(p, 'margin', 'Left', 'X'),
    marginRight: side(p, 'margin', 'Right', 'X'),
    paddingTop: side(p, 'padding', 'Top', 'Y'),
    paddingBottom: side(p, 'padding', 'Bottom', 'Y'),
    paddingLeft: side(p, 'padding', 'Left', 'X'),
    paddingRight: side(p, 'padding', 'Right', 'X'),
    overflow: p.overflow as CSSProperties['overflow'],
    backgroundColor: colorOf(paint, p.backgroundColor),
    position: p.position as CSSProperties['position'],
    top: rows(p.top),
    left: columns(p.left),
    right: columns(p.right),
    bottom: rows(p.bottom),
    boxSizing: 'border-box',
  }
  if (typeof p.borderStyle === 'string') {
    const isDim = (hover !== undefined && isHovered ? (hover.borderDimColor ?? p.borderDimColor) : p.borderDimColor) === true
    const color = colorOf(paint, p.borderColor) ?? 'currentColor'
    style.border = `1px ${p.borderStyle === 'dashed' ? 'dashed' : p.borderStyle === 'double' ? 'double' : 'solid'}`
    style.borderColor = isDim ? `color-mix(in srgb, ${color} 40%, transparent)` : color
    style.borderRadius = p.borderStyle === 'round' ? 6 : 0
  }
  return style
}

function textStyle(paint: Paint, own: Props, hover: Props | undefined, isHovered: boolean): CSSProperties {
  const p = isHovered && hover !== undefined ? { ...own, ...hover } : own
  const isDim = p.dimColor === true
  let color = colorOf(paint, p.color) ?? (isDim && paint.surface === 'desktop' ? paint.chrome.dim : undefined)
  let background = colorOf(paint, p.backgroundColor)
  if (p.inverse === true) {
    ;[color, background] = [background ?? paint.chrome.background, color ?? paint.chrome.color]
  }
  const lines = [p.underline === true ? 'underline' : '', p.strikethrough === true ? 'line-through' : '']
  return {
    color,
    backgroundColor: background,
    // The terminal's dim is faint text in whatever color it has.
    opacity: isDim && paint.surface === 'terminal' ? 0.55 : undefined,
    fontWeight: p.bold === true ? 600 : undefined,
    fontStyle: p.italic === true ? 'italic' : undefined,
    textDecoration: lines.filter(Boolean).join(' ') || undefined,
    textUnderlineOffset: 3,
    whiteSpace: p.wrap === undefined || p.wrap === 'wrap' ? 'pre-wrap' : 'pre',
    overflow: p.wrap?.toString().startsWith('truncate') ? 'hidden' : undefined,
    textOverflow: p.wrap?.toString().startsWith('truncate') ? 'ellipsis' : undefined,
  }
}

function Box({ element }: { element: RenderElement }) {
  const paint = usePaint()
  const inherited = useContext(HoverContext)
  const [isOver, setIsOver] = useState(false)
  const isScope = typeof element.props.key === 'string'
  const isHovered = isScope ? isOver : inherited
  const box = (
    <div
      data-type="Box"
      data-key={isScope ? (element.props.key as string) : undefined}
      style={boxStyle(paint, element.props, element.hover, isHovered)}
      onMouseEnter={isScope ? () => setIsOver(true) : undefined}
      onMouseLeave={isScope ? () => setIsOver(false) : undefined}
    >
      {element.children.map((child, i) => (
        // Core wraps a Box's strings in a Text.
        <Node key={i} node={typeof child === 'string' ? { type: 'Text', props: {}, children: [child] } : child} />
      ))}
    </div>
  )
  return isScope ? <HoverContext.Provider value={isOver}>{box}</HoverContext.Provider> : box
}

function Text({ element }: { element: RenderElement }) {
  const paint = usePaint()
  const isHovered = useContext(HoverContext)
  return (
    <span data-type="Text" style={textStyle(paint, element.props, element.hover, isHovered)}>
      {element.children.map((child, i) => (
        <Node key={i} node={child} />
      ))}
    </span>
  )
}

function Link({ element }: { element: RenderElement }) {
  const { href, label } = element.props as { href: string; label?: string }
  const children: ReactNode =
    element.children.length > 0 ? element.children.map((child, i) => <Node key={i} node={child} />) : (label ?? href)
  return (
    <a data-type="Link" href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
      {children}
    </a>
  )
}

function Svg({ element }: { element: RenderElement }) {
  const { source, alt, width, height } = element.props as { source: string; alt: string; width?: number; height?: number }
  return (
    <img
      data-type="Svg"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`}
      alt={alt}
      title={alt}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  )
}

// What the preview does not draw: named, so a story shows it is missing.
function Unknown({ element }: { element: RenderElement }) {
  return <span style={{ outline: '1px dashed #d1454f', padding: '0 2px', color: '#d1454f' }}>{`<${element.type}>`}</span>
}

const ELEMENTS: Record<string, (props: { element: RenderElement }) => ReactNode> = { Box, Text, Link, Svg }

function Node({ node }: { node: RenderNode }) {
  if (typeof node === 'string') return <>{node}</>
  const Drawn = ELEMENTS[node.type] ?? Unknown
  return <Drawn element={node} />
}

type SurfaceProps = {
  surface: SurfaceName
  tree: unknown
  theme?: Theme
  // The band's width in cells; absent, the frame's.
  columns?: number
}

export function Surface({ surface, tree, theme, columns: width }: SurfaceProps) {
  const fromToolbar = useContext(ThemeContext)
  const paint: Paint = { surface, theme: theme ?? fromToolbar, chrome: CHROME[surface][theme ?? fromToolbar] }
  return (
    <PaintContext.Provider value={paint}>
      <div
        data-surface={surface}
        data-theme={paint.theme}
        style={{
          background: paint.chrome.background,
          color: paint.chrome.color,
          fontFamily: paint.chrome.fontFamily,
          fontSize: 13,
          lineHeight: LINE_HEIGHT,
          padding: '10px 14px',
          borderRadius: surface === 'desktop' ? 12 : 4,
          width: width === undefined ? undefined : `calc(${width}ch + 28px)`,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {tree === null || tree === undefined ? null : <Node node={tree as RenderNode} />}
      </div>
    </PaintContext.Provider>
  )
}

// Claude Code's JSX runtime and element tables as plain data, so a mod's UI
// modules run outside the engine (Vitest, Storybook). `h` calls every tag, as
// the engine's does; the constructors build the `{ type, props, hover,
// children }` nodes the engine validates. No paint: see Surface.tsx for that.

export type SurfaceName = 'terminal' | 'desktop'

export type Props = Record<string, unknown>

export type RenderElement = {
  type: string
  props: Props
  hover?: Props
  children: RenderNode[]
}

export type RenderNode = RenderElement | string

type Tag = (props: Props) => unknown

// Children in order: arrays flattened, numbers as text, nothing for
// null, undefined and booleans.
export function flatten(children: unknown, out: RenderNode[] = []): RenderNode[] {
  if (Array.isArray(children)) {
    for (const child of children) flatten(child, out)
  } else if (typeof children === 'string') {
    out.push(children)
  } else if (typeof children === 'number') {
    out.push(String(children))
  } else if (children !== null && children !== undefined && typeof children !== 'boolean') {
    out.push(children as RenderElement)
  }
  return out
}

// Props the tree carries: `undefined` is no prop at all.
function defined(props: Props): Props {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
}

function element(type: string) {
  return ({ children, hover, ...props }: Props): RenderElement => ({
    type,
    props: defined(props),
    ...(hover === undefined ? {} : { hover: defined(hover as Props) }),
    children: flatten(children),
  })
}

export function h(tag: Tag, props: Props | null | undefined, ...children: unknown[]): unknown {
  return tag({ ...props, ...(children.length === 0 ? {} : { children }) })
}

// `<>...</>`: a column Box around the children.
export function Fragment({ children }: Props): RenderElement {
  return element('Box')({ flexDirection: 'column', children })
}

const TERMINAL = { Box: element('Box'), Text: element('Text'), Link: element('Link') }
const DESKTOP = { ...TERMINAL, Svg: element('Svg') }

// The part of `$.ui.resolve(e)` a statusline draws with, per surface.
export function elementsFor(surface: 'terminal'): typeof TERMINAL
export function elementsFor(surface: 'desktop'): typeof DESKTOP
export function elementsFor(surface: SurfaceName): typeof TERMINAL | typeof DESKTOP
export function elementsFor(surface: SurfaceName) {
  return surface === 'desktop' ? DESKTOP : TERMINAL
}

// The globals the engine gives a module that writes JSX.
export function installRuntime() {
  Object.assign(globalThis, { h, Fragment })
}

// Reading a plain-data tree in specs: its text, and the elements in it.
import type { RenderElement, RenderNode } from './runtime'

export function textOf(node: RenderNode): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('')
}

export function findAll(node: RenderNode, match: (element: RenderElement) => boolean): RenderElement[] {
  if (typeof node === 'string') return []
  const below = node.children.flatMap(child => findAll(child, match))
  return match(node) ? [node, ...below] : below
}

export function ofType(node: RenderNode, type: string): RenderElement[] {
  return findAll(node, element => element.type === type)
}

export function findByKey(node: RenderNode, key: string): RenderElement | undefined {
  return findAll(node, element => element.props.key === key)[0]
}

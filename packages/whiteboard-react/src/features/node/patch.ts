import type { Node, NodePatch } from '@whiteboard/core/types'
import { mergeRecordPatch } from '../../runtime/utils/recordPatch'

export type GroupAutoFitMode = 'expand-only' | 'manual'

export type NodeStylePatch = Record<string, string | number>

export const mergeNodeStyle = (
  current: Node['style'],
  patch: NodeStylePatch
) => mergeRecordPatch(current, patch)

export const removeNodeStyleKey = (
  current: Node['style'],
  key: string
) => {
  if (!current || !(key in current)) {
    return current
  }

  const next = {
    ...current
  }
  delete next[key]
  return Object.keys(next).length > 0 ? next : undefined
}

export const toNodeStylePatch = (
  node: Pick<Node, 'style'>,
  patch: NodeStylePatch
): NodePatch => ({
  style: mergeNodeStyle(node.style, patch)
})

export const toNodeStyleRemovalPatch = (
  node: Pick<Node, 'style'>,
  key: string
): NodePatch => ({
  style: removeNodeStyleKey(node.style, key)
})

export const toNodeStyleUpdates = (
  nodes: readonly Node[],
  patch: NodeStylePatch
) => nodes.map((node) => ({
  id: node.id,
  patch: toNodeStylePatch(node, patch)
}))

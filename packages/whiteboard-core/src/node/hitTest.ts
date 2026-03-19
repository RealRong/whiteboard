import type { NodeId, Rect } from '../types'
import {
  rectContainsRotatedRect,
  rectIntersectsRotatedRect
} from '../geometry'

export type NodeRectHitEntry = {
  node: {
    id: NodeId
    type: string
  }
  rect: Rect
  rotation: number
}

export type NodeRectHitOptions = {
  match?: 'touch' | 'contain'
  exclude?: readonly NodeId[]
}

export const getNodeIdsInRect = (
  rect: Rect,
  entries: NodeRectHitEntry[],
  options?: NodeRectHitOptions
): NodeId[] => {
  const match = options?.match ?? 'touch'
  const exclude = options?.exclude?.length
    ? new Set(options.exclude)
    : undefined

  return entries
    .filter((entry) => {
      if (exclude?.has(entry.node.id)) {
        return false
      }

      return match === 'contain'
        ? rectContainsRotatedRect(rect, entry.rect, entry.rotation)
        : rectIntersectsRotatedRect(rect, entry.rect, entry.rotation)
    })
    .map((entry) => entry.node.id)
}

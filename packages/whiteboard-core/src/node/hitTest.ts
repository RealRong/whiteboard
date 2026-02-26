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

export const getNodeIdsInRect = (rect: Rect, entries: NodeRectHitEntry[]): NodeId[] =>
  entries
    .filter((entry) => {
      if (entry.node.type === 'group') {
        return rectContainsRotatedRect(rect, entry.rect, entry.rotation)
      }
      return rectIntersectsRotatedRect(rect, entry.rect, entry.rotation)
    })
    .map((entry) => entry.node.id)

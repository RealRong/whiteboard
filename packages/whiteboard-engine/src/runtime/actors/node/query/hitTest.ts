import type { NodeId, Rect } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '@engine-types/instance/view'
import {
  rectContainsRotatedRect,
  rectIntersectsRotatedRect
} from '@whiteboard/core/geometry'

export const getNodeIdsInRect = (rect: Rect, entries: CanvasNodeRect[]): NodeId[] =>
  entries
    .filter((entry) => {
      if (entry.node.type === 'group') {
        return rectContainsRotatedRect(rect, entry.rect, entry.rotation)
      }
      return rectIntersectsRotatedRect(rect, entry.rect, entry.rotation)
    })
    .map((entry) => entry.node.id)

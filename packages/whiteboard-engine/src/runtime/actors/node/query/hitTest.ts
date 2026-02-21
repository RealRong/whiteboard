import type { NodeId, Rect } from '@whiteboard/core'
import type { CanvasNodeRect } from '@engine-types/instance/view'
import {
  rectContainsRotatedRect,
  rectIntersectsRotatedRect
} from '../../../../runtime/common/geometry'

export const getNodeIdsInRect = (rect: Rect, entries: CanvasNodeRect[]): NodeId[] =>
  entries
    .filter((entry) => {
      if (entry.node.type === 'group') {
        return rectContainsRotatedRect(rect, entry.rect, entry.rotation)
      }
      return rectIntersectsRotatedRect(rect, entry.rect, entry.rotation)
    })
    .map((entry) => entry.node.id)

type BackgroundTargetInput = {
  container: HTMLDivElement | null
  target: EventTarget | null
}

export const isBackgroundTarget = ({ container, target }: BackgroundTargetInput) => {
  if (!(target instanceof HTMLElement)) return false
  if (!container?.contains(target)) return false
  if (target.closest('[data-node-id]')) return false
  if (target.closest('[data-mindmap-node-id]')) return false
  if (target.closest('[data-selection-ignore]')) return false
  return true
}

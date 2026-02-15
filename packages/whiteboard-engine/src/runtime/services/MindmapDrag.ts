import type { MindmapNodeId, Rect } from '@whiteboard/core'
import type { MindmapDrag as MindmapDragApi } from '@engine-types/instance/services'
import { computeMindmapSubtreeDropTarget } from '../../mindmap'

export class MindmapDrag implements MindmapDragApi {
  buildNodeRectMap: MindmapDragApi['buildNodeRectMap'] = ({ nodeRects, shift, offset }) => {
    const rectMap = new Map<MindmapNodeId, Rect>()
    Object.entries(nodeRects).forEach(([id, rect]) => {
      if (!rect) return
      rectMap.set(id as MindmapNodeId, {
        x: rect.x + shift.x + offset.x,
        y: rect.y + shift.y + offset.y,
        width: rect.width,
        height: rect.height
      })
    })
    return rectMap
  }

  buildSubtreeGhostRect: MindmapDragApi['buildSubtreeGhostRect'] = ({ pointerWorld, pointerOffset, nodeRect }) => ({
    x: pointerWorld.x - pointerOffset.x,
    y: pointerWorld.y - pointerOffset.y,
    width: nodeRect.width,
    height: nodeRect.height
  })

  computeSubtreeDropTarget: MindmapDragApi['computeSubtreeDropTarget'] = (options) =>
    computeMindmapSubtreeDropTarget(options)

  dispose: MindmapDragApi['dispose'] = () => {
    return
  }
}

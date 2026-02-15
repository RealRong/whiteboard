import type { MindmapNodeId, Rect } from '@whiteboard/core'
import type { MindmapDragService as MindmapDragServiceApi } from '@engine-types/instance/services'
import { computeMindmapSubtreeDropTarget } from '../../mindmap/domain/computeSubtreeDropTarget'

export class MindmapDragService implements MindmapDragServiceApi {
  buildNodeRectMap: MindmapDragServiceApi['buildNodeRectMap'] = ({ nodeRects, shift, offset }) => {
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

  buildSubtreeGhostRect: MindmapDragServiceApi['buildSubtreeGhostRect'] = ({ pointerWorld, pointerOffset, nodeRect }) => ({
    x: pointerWorld.x - pointerOffset.x,
    y: pointerWorld.y - pointerOffset.y,
    width: nodeRect.width,
    height: nodeRect.height
  })

  computeSubtreeDropTarget: MindmapDragServiceApi['computeSubtreeDropTarget'] = (options) =>
    computeMindmapSubtreeDropTarget(options)

  dispose: MindmapDragServiceApi['dispose'] = () => {
    return
  }
}

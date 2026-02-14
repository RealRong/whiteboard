import type { NodeId, Rect } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { WhiteboardInstance } from '@engine-types/instance'
import type {
  NodeTransformResizeDragState,
  NodeTransformRotateDragState,
  NodeTransformService as NodeTransformServiceApi
} from '@engine-types/instance/services'
import { getRectCenter } from '../../geometry/geometry'
import { computeResizeSnap } from '../../node/utils/snap'
import { computeNextRotation, computeResizeRect, getResizeSourceEdges } from '../../node/utils/transform'

const MIN_ZOOM = 0.0001

const getMovingRectQueryRect = (rect: Rect, thresholdWorld: number): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

export class NodeTransformService implements NodeTransformServiceApi {
  private instance: WhiteboardInstance

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  clear: NodeTransformServiceApi['clear'] = () => {
    this.instance.commands.nodeTransform.clearGuides()
  }

  createResizeDrag: NodeTransformServiceApi['createResizeDrag'] = ({
    pointerId,
    handle,
    clientX,
    clientY,
    rect,
    rotation
  }) => ({
    mode: 'resize',
    pointerId,
    handle,
    startScreen: { x: clientX, y: clientY },
    startCenter: getRectCenter(rect),
    startRotation: rotation,
    startSize: { width: rect.width, height: rect.height },
    startAspect: rect.width / Math.max(rect.height, MIN_ZOOM)
  })

  createRotateDrag: NodeTransformServiceApi['createRotateDrag'] = ({
    pointerId,
    clientX,
    clientY,
    rect,
    rotation
  }) => {
    const center = getRectCenter(rect)
    const worldPoint = this.instance.runtime.viewport.clientToWorld(clientX, clientY)
    const startAngle = Math.atan2(worldPoint.y - center.y, worldPoint.x - center.x)
    return {
      mode: 'rotate',
      pointerId,
      startAngle,
      startRotation: rotation,
      center
    }
  }

  applyResizeMove: NodeTransformServiceApi['applyResizeMove'] = ({
    nodeId,
    drag,
    clientX,
    clientY,
    minSize,
    altKey,
    shiftKey
  }) => {
    const zoom = Math.max(this.instance.runtime.viewport.getZoom(), MIN_ZOOM)
    const resizeResult = computeResizeRect({
      handle: drag.handle,
      startScreen: drag.startScreen,
      currentScreen: { x: clientX, y: clientY },
      startCenter: drag.startCenter,
      startRotation: drag.startRotation,
      startSize: drag.startSize,
      startAspect: drag.startAspect,
      minSize,
      zoom,
      altKey,
      shiftKey
    })

    let width = resizeResult.width
    let height = resizeResult.height
    let nextRect = { x: resizeResult.rect.x, y: resizeResult.rect.y }

    if (this.instance.state.read('tool') === 'select') {
      if (drag.startRotation === 0 && !altKey) {
        const nodeConfig = this.instance.runtime.config.node
        const thresholdWorld = Math.min(nodeConfig.snapThresholdScreen / zoom, nodeConfig.snapMaxThresholdWorld)
        const movingRect: Rect = {
          x: nextRect.x,
          y: nextRect.y,
          width,
          height
        }
        const candidates = this.instance.query.getSnapCandidatesInRect(getMovingRectQueryRect(movingRect, thresholdWorld))
        const { sourceX, sourceY } = getResizeSourceEdges(drag.handle)
        const snapped = computeResizeSnap({
          movingRect,
          candidates,
          threshold: thresholdWorld,
          minSize,
          excludeId: nodeId,
          sourceEdges: { sourceX, sourceY }
        })
        width = snapped.width
        height = snapped.height
        nextRect = { x: snapped.rect.x, y: snapped.rect.y }
        this.instance.commands.nodeTransform.setGuides(snapped.guides)
      } else {
        this.clear()
      }
    }

    const update = {
      position: { x: nextRect.x, y: nextRect.y },
      size: { width, height }
    }

    drag.lastUpdate = update
    this.instance.commands.nodeTransform.previewResize(nodeId, update)
  }

  applyRotateMove: NodeTransformServiceApi['applyRotateMove'] = ({ nodeId, drag, clientX, clientY, shiftKey }) => {
    const worldPoint = this.instance.runtime.viewport.clientToWorld(clientX, clientY)
    const nextRotation = computeNextRotation({
      center: drag.center,
      currentPoint: worldPoint,
      startAngle: drag.startAngle,
      startRotation: drag.startRotation,
      shiftKey
    })
    void this.instance.commands.nodeTransform.rotate(nodeId, nextRotation)
  }

  finishResize: NodeTransformServiceApi['finishResize'] = ({ nodeId, drag }) => {
    if (drag.lastUpdate) {
      this.instance.commands.nodeTransform.commitResize(nodeId, drag.lastUpdate)
    }
    this.clear()
  }

  dispose: NodeTransformServiceApi['dispose'] = () => {
    this.clear()
  }
}

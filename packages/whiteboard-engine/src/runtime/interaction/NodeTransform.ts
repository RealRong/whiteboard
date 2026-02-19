import type { NodeId, Rect } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import type { ResizeDirection, ResizeDragState, RotateDragState } from '@engine-types/node'
import { DEFAULT_INTERNALS } from '../../config'
import { getRectCenter } from '../../kernel/geometry'
import { computeResizeSnap } from '../../node/utils/snap'
import { computeNextRotation, computeResizeRect, getResizeSourceEdges } from '../../node/utils/transform'

type NodeTransformApi = RuntimeInteraction['nodeTransform']

const getMovingRectQueryRect = (rect: Rect, thresholdWorld: number): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

export class NodeTransform implements NodeTransformApi {
  private readonly instance: InternalInstance

  constructor(instance: InternalInstance) {
    this.instance = instance
  }

  private clear = () => {
    this.instance.commands.transient.dragGuides.clear()
  }

  private createResizeDrag = (options: {
    pointerId: number
    handle: ResizeDirection
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }): ResizeDragState => {
    const { pointerId, handle, clientX, clientY, rect, rotation } = options
    return {
      mode: 'resize',
      pointerId,
      handle,
      startScreen: { x: clientX, y: clientY },
      startCenter: getRectCenter(rect),
      startRotation: rotation,
      startSize: { width: rect.width, height: rect.height },
      startAspect: rect.width / Math.max(rect.height, DEFAULT_INTERNALS.zoomEpsilon)
    }
  }

  private createRotateDrag = (options: {
    pointerId: number
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }): RotateDragState => {
    const { pointerId, clientX, clientY, rect, rotation } = options
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

  private applyResizeMove = (options: {
    nodeId: NodeId
    drag: ResizeDragState
    clientX: number
    clientY: number
    minSize: Size
    altKey: boolean
    shiftKey: boolean
  }) => {
    const { nodeId, drag, clientX, clientY, minSize, altKey, shiftKey } = options
    const zoom = Math.max(this.instance.runtime.viewport.getZoom(), DEFAULT_INTERNALS.zoomEpsilon)
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
        const candidates = this.instance.query.snap.candidatesInRect(getMovingRectQueryRect(movingRect, thresholdWorld))
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
        this.instance.commands.transient.dragGuides.set(snapped.guides)
      } else {
        this.clear()
      }
    }

    const update = {
      position: { x: nextRect.x, y: nextRect.y },
      size: { width, height }
    }

    drag.lastUpdate = update
    this.instance.commands.transient.nodeOverrides.set([{ id: nodeId, ...update }])
  }

  private applyRotateMove = (options: {
    nodeId: NodeId
    drag: RotateDragState
    clientX: number
    clientY: number
    shiftKey: boolean
  }) => {
    const { nodeId, drag, clientX, clientY, shiftKey } = options
    const worldPoint = this.instance.runtime.viewport.clientToWorld(clientX, clientY)
    const nextRotation = computeNextRotation({
      center: drag.center,
      currentPoint: worldPoint,
      startAngle: drag.startAngle,
      startRotation: drag.startRotation,
      shiftKey
    })
    void this.instance.apply(
      [{ type: 'node.rotate', id: nodeId, angle: nextRotation }],
      { source: 'interaction' }
    )
  }

  private finishResize = (options: {
    nodeId: NodeId
    drag: ResizeDragState
  }) => {
    const { nodeId, drag } = options
    if (drag.lastUpdate) {
      this.instance.commands.transient.nodeOverrides.commit([{ id: nodeId, ...drag.lastUpdate }])
    }
    this.clear()
  }

  startResize: NodeTransformApi['startResize'] = ({
    nodeId,
    pointerId,
    handle,
    clientX,
    clientY,
    rect,
    rotation
  }) => {
    const { state } = this.instance
    if (state.read('nodeTransform').active) return false
    const drag = this.createResizeDrag({
      pointerId,
      handle,
      clientX,
      clientY,
      rect,
      rotation
    })
    state.write('nodeTransform', {
      active: {
        nodeId,
        drag
      }
    })
    return true
  }

  startRotate: NodeTransformApi['startRotate'] = ({
    nodeId,
    pointerId,
    clientX,
    clientY,
    rect,
    rotation
  }) => {
    const { state } = this.instance
    if (state.read('nodeTransform').active) return false
    const drag = this.createRotateDrag({
      pointerId,
      clientX,
      clientY,
      rect,
      rotation
    })
    state.write('nodeTransform', {
      active: {
        nodeId,
        drag
      }
    })
    return true
  }

  update: NodeTransformApi['update'] = ({
    pointerId,
    clientX,
    clientY,
    minSize,
    altKey,
    shiftKey
  }) => {
    const { state } = this.instance
    const active = state.read('nodeTransform').active
    if (!active || active.drag.pointerId !== pointerId) return false

    state.batchFrame(() => {
      if (active.drag.mode === 'resize') {
        this.applyResizeMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX,
          clientY,
          minSize,
          altKey: Boolean(altKey),
          shiftKey: Boolean(shiftKey)
        })
      } else {
        this.applyRotateMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX,
          clientY,
          shiftKey: Boolean(shiftKey)
        })
      }

      state.write('nodeTransform', {
        active
      })
    })
    return true
  }

  end: NodeTransformApi['end'] = ({ pointerId }) => {
    const { state } = this.instance
    const active = state.read('nodeTransform').active
    if (!active || active.drag.pointerId !== pointerId) return false

    if (active.drag.mode === 'resize') {
      this.finishResize({
        nodeId: active.nodeId,
        drag: active.drag
      })
    } else {
      this.clear()
    }

    state.write('nodeTransform', {})
    return true
  }

  cancel: NodeTransformApi['cancel'] = (options) => {
    const { state, commands } = this.instance
    const active = state.read('nodeTransform').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.drag.pointerId !== options.pointerId) return false

    if (active.drag.mode === 'resize') {
      commands.transient.nodeOverrides.clear([active.nodeId])
    }
    this.clear()
    state.write('nodeTransform', {})
    return true
  }
}

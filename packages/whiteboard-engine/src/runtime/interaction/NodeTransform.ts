import type { NodeId, Rect } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import type { ResizeDirection, ResizeDragState, RotateDragState } from '@engine-types/node'
import type { InteractionContext } from '../../context'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../config'
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
  private readonly instance: InteractionContext['instance']

  constructor(context: InteractionContext) {
    this.instance = context.instance
  }

  private clear = () => {
    this.instance.commands.transient.dragGuides.clear()
  }

  private createResizeDrag = (options: {
    pointer: { pointerId: number; client: { x: number; y: number } }
    handle: ResizeDirection
    rect: Rect
    rotation: number
  }): ResizeDragState => {
    const { pointer, handle, rect, rotation } = options
    return {
      mode: 'resize',
      pointerId: pointer.pointerId,
      handle,
      startScreen: { x: pointer.client.x, y: pointer.client.y },
      startCenter: getRectCenter(rect),
      startRotation: rotation,
      startSize: { width: rect.width, height: rect.height },
      startAspect: rect.width / Math.max(rect.height, DEFAULT_INTERNALS.zoomEpsilon)
    }
  }

  private createRotateDrag = (options: {
    pointer: {
      pointerId: number
      world: { x: number; y: number }
    }
    rect: Rect
    rotation: number
  }): RotateDragState => {
    const { pointer, rect, rotation } = options
    const center = getRectCenter(rect)
    const worldPoint = pointer.world
    const startAngle = Math.atan2(worldPoint.y - center.y, worldPoint.x - center.x)
    return {
      mode: 'rotate',
      pointerId: pointer.pointerId,
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
    pointer,
    handle,
    rect,
    rotation
  }) => {
    const { state } = this.instance
    if (state.read('nodeTransform').active) return false
    const drag = this.createResizeDrag({
      pointer,
      handle,
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
    pointer,
    rect,
    rotation
  }) => {
    const { state } = this.instance
    if (state.read('nodeTransform').active) return false
    const drag = this.createRotateDrag({
      pointer,
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
    pointer,
    minSize
  }) => {
    const { state } = this.instance
    const active = state.read('nodeTransform').active
    if (!active || active.drag.pointerId !== pointer.pointerId) return false
    const resolvedMinSize = minSize ?? DEFAULT_TUNING.nodeTransform.minSize

    state.batchFrame(() => {
      if (active.drag.mode === 'resize') {
        this.applyResizeMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX: pointer.client.x,
          clientY: pointer.client.y,
          minSize: resolvedMinSize,
          altKey: pointer.modifiers.alt,
          shiftKey: pointer.modifiers.shift
        })
      } else {
        this.applyRotateMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX: pointer.client.x,
          clientY: pointer.client.y,
          shiftKey: pointer.modifiers.shift
        })
      }

      state.write('nodeTransform', {
        active
      })
    })
    return true
  }

  end: NodeTransformApi['end'] = ({ pointer }) => {
    const { state } = this.instance
    const active = state.read('nodeTransform').active
    if (!active || active.drag.pointerId !== pointer.pointerId) return false

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
    if (options?.pointer && active.drag.pointerId !== options.pointer.pointerId) return false

    if (active.drag.mode === 'resize') {
      commands.transient.nodeOverrides.clear([active.nodeId])
    }
    this.clear()
    state.write('nodeTransform', {})
    return true
  }
}

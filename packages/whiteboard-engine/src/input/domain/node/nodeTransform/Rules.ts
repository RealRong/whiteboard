import type { PointerInput, Size } from '@engine-types/common'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { Guide } from '@engine-types/node/snap'
import type { ResizeDirection, ResizeDragState, RotateDragState } from '@engine-types/node'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  computeNextRotation,
  computeResizeRect,
  computeResizeSnap,
  getResizeSourceEdges
} from '@whiteboard/core/node'
import { getRectCenter } from '@whiteboard/core/geometry'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'

type RulesOptions = {
  config: InstanceConfig
  query: Pick<Query, 'snap'>
  readTool: () => 'select' | 'edge'
  readZoom: () => number
}

const resolveInteractionZoom = (zoom: number) =>
  Math.max(zoom, DEFAULT_INTERNALS.zoomEpsilon)

const resolveSnapThresholdWorld = (
  config: InstanceConfig['node'],
  zoom: number
) =>
  Math.min(
    config.snapThresholdScreen / resolveInteractionZoom(zoom),
    config.snapMaxThresholdWorld
  )

const expandRectByThreshold = (
  rect: Rect,
  thresholdWorld: number
): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

export class Rules {
  private readonly config: RulesOptions['config']
  private readonly query: RulesOptions['query']
  private readonly readTool: RulesOptions['readTool']
  private readonly readZoom: RulesOptions['readZoom']

  constructor(options: RulesOptions) {
    this.config = options.config
    this.query = options.query
    this.readTool = options.readTool
    this.readZoom = options.readZoom
  }

  createResizeDrag = (options: {
    pointer: PointerInput
    handle: ResizeDirection
    rect: Rect
    rotation: number
  }): ResizeDragState => {
    const { pointer, handle, rect, rotation } = options
    return {
      mode: 'resize',
      pointerId: pointer.pointerId,
      handle,
      startScreen: {
        x: pointer.client.x,
        y: pointer.client.y
      },
      startCenter: getRectCenter(rect),
      startRotation: rotation,
      startSize: {
        width: rect.width,
        height: rect.height
      },
      startAspect: rect.width / Math.max(rect.height, DEFAULT_INTERNALS.zoomEpsilon)
    }
  }

  createRotateDrag = (options: {
    pointer: PointerInput
    rect: Rect
    rotation: number
  }): RotateDragState => {
    const { pointer, rect, rotation } = options
    const center = getRectCenter(rect)
    const startAngle = Math.atan2(
      pointer.world.y - center.y,
      pointer.world.x - center.x
    )
    return {
      mode: 'rotate',
      pointerId: pointer.pointerId,
      startAngle,
      startRotation: rotation,
      center
    }
  }

  resolveResizeMove = (options: {
    nodeId: NodeId
    drag: ResizeDragState
    pointer: PointerInput
    minSize: Size
  }): {
    update: {
      position: Point
      size: Size
    }
    guides: Guide[]
  } => {
    const { nodeId, drag, pointer, minSize } = options
    const zoom = resolveInteractionZoom(this.readZoom())
    const resized = computeResizeRect({
      handle: drag.handle,
      startScreen: drag.startScreen,
      currentScreen: {
        x: pointer.client.x,
        y: pointer.client.y
      },
      startCenter: drag.startCenter,
      startRotation: drag.startRotation,
      startSize: drag.startSize,
      startAspect: drag.startAspect,
      minSize,
      zoom,
      altKey: pointer.modifiers.alt,
      shiftKey: pointer.modifiers.shift
    })

    let nextRect = resized.rect
    let nextSize = {
      width: resized.width,
      height: resized.height
    }
    let guides: Guide[] = []

    if (
      this.readTool() === 'select' &&
      drag.startRotation === 0 &&
      !pointer.modifiers.alt
    ) {
      const thresholdWorld = resolveSnapThresholdWorld(
        this.config.node,
        zoom
      )
      const movingRect: Rect = {
        x: nextRect.x,
        y: nextRect.y,
        width: nextSize.width,
        height: nextSize.height
      }
      const candidates = this.query.snap.candidatesInRect(
        expandRectByThreshold(movingRect, thresholdWorld)
      )
      const { sourceX, sourceY } = getResizeSourceEdges(drag.handle)
      const snapped = computeResizeSnap({
        movingRect,
        candidates,
        threshold: thresholdWorld,
        minSize,
        excludeId: nodeId,
        sourceEdges: {
          sourceX,
          sourceY
        }
      })
      nextRect = snapped.rect
      nextSize = {
        width: snapped.width,
        height: snapped.height
      }
      guides = snapped.guides
    }

    return {
      update: {
        position: {
          x: nextRect.x,
          y: nextRect.y
        },
        size: nextSize
      },
      guides
    }
  }

  resolveRotate = (options: {
    drag: RotateDragState
    pointer: PointerInput
  }) =>
    computeNextRotation({
      center: options.drag.center,
      currentPoint: options.pointer.world,
      startAngle: options.drag.startAngle,
      startRotation: options.drag.startRotation,
      shiftKey: options.pointer.modifiers.shift
    })

  resolveMinSize = (minSize?: Size): Size =>
    minSize ?? DEFAULT_TUNING.nodeTransform.minSize
}

import {
  getRectCenter,
  isPointEqual,
  isSizeEqual
} from '@whiteboard/core/geometry'
import {
  computeNextRotation,
  computeResizeRect,
  getResizeSourceEdges,
  getResizeUpdateRect,
  projectResizePatches,
  type ResizeDirection,
  type TransformHandle,
  type TransformPreviewPatch
} from '@whiteboard/core/node'
import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasFrameDown } from '../../../../runtime/input/pointer'
import type { InternalInstance } from '../../../../runtime/instance'
import { resolveSelectionBoxView } from '../../selection'
import {
  clearNodeSessionPreview,
  writeNodeSessionPreview
} from '../../session/node'

const RESIZE_MIN_SIZE = {
  width: 20,
  height: 20
}

const ZOOM_EPSILON = 0.0001

type ResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: ResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: {
    width: number
    height: number
  }
  startAspect: number
}

type RotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  center: Point
}

type TransformDragState = ResizeDragState | RotateDragState

type TransformTarget = {
  id: NodeId
  node: Node
  rect: Rect
}

type ActiveTransform = {
  targets: readonly TransformTarget[]
  commitTargetIds?: ReadonlySet<NodeId>
  drag: TransformDragState
  patches?: readonly TransformPreviewPatch[]
}

type TransformPointerEvent = PointerEvent | ReactPointerEvent<Element>
type TransformPickHandle = Pick<TransformHandle, 'kind' | 'direction'>

const createResizeDrag = (options: {
  pointerId: number
  handle: ResizeDirection
  rect: Rect
  rotation: number
  startScreen: Point
}): ResizeDragState => ({
  mode: 'resize',
  pointerId: options.pointerId,
  handle: options.handle,
  startScreen: options.startScreen,
  startCenter: getRectCenter(options.rect),
  startRotation: options.rotation,
  startSize: {
    width: options.rect.width,
    height: options.rect.height
  },
  startAspect: options.rect.width / Math.max(options.rect.height, ZOOM_EPSILON)
})

const createRotateDrag = (options: {
  pointerId: number
  rect: Rect
  rotation: number
  start: Point
}): RotateDragState => {
  const center = getRectCenter(options.rect)
  return {
    mode: 'rotate',
    pointerId: options.pointerId,
    startAngle: Math.atan2(options.start.y - center.y, options.start.x - center.x),
    startRotation: options.rotation,
    center
  }
}

const getResizeStartRect = (
  drag: ResizeDragState
): Rect => ({
  x: drag.startCenter.x - drag.startSize.width / 2,
  y: drag.startCenter.y - drag.startSize.height / 2,
  width: drag.startSize.width,
  height: drag.startSize.height
})

const toPatch = (
  node: Node,
  preview: TransformPreviewPatch
) => {
  const patch: NodePatch = {}
  const position = node.type === 'group' ? undefined : node.position
  const size = node.type === 'group' ? undefined : node.size
  const rotation = node.type === 'group' ? undefined : node.rotation

  if (preview.position && !isPointEqual(preview.position, position)) {
    patch.position = preview.position
  }
  if (preview.size && !isSizeEqual(preview.size, size)) {
    patch.size = preview.size
  }
  if (
    typeof preview.rotation === 'number'
    && preview.rotation !== (rotation ?? 0)
  ) {
    patch.rotation = preview.rotation
  }

  if (!patch.position && !patch.size && patch.rotation === undefined) {
    return undefined
  }

  return patch
}

export const createTransformSession = (
  instance: InternalInstance
) => {
  let active: ActiveTransform | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const clear = () => {
    active = null
    session = null
    clearNodeSessionPreview(instance.internals.node.session)
    instance.internals.snap.node.clear()
  }

  const writePreview = (
    patches: readonly TransformPreviewPatch[]
  ) => {
    writeNodeSessionPreview(instance.internals.node.session, {
      patches
    })
  }

  const buildResizeUpdate = (options: {
    drag: ResizeDragState
    currentScreen: Point
    zoom: number
    altKey: boolean
    shiftKey: boolean
    excludeNodeIds: readonly NodeId[]
  }) => {
    const rawRect = computeResizeRect({
      handle: options.drag.handle,
      startScreen: options.drag.startScreen,
      currentScreen: options.currentScreen,
      startCenter: options.drag.startCenter,
      startRotation: options.drag.startRotation,
      startSize: options.drag.startSize,
      startAspect: options.drag.startAspect,
      zoom: Math.max(options.zoom, ZOOM_EPSILON),
      altKey: options.altKey,
      shiftKey: options.shiftKey,
      minSize: RESIZE_MIN_SIZE
    })
    const { sourceX, sourceY } = getResizeSourceEdges(options.drag.handle)

    return instance.internals.snap.node.resize({
      rect: rawRect.rect,
      source: {
        x: sourceX,
        y: sourceY
      },
      minSize: RESIZE_MIN_SIZE,
      excludeIds: options.excludeNodeIds,
      disabled: options.altKey || options.drag.startRotation !== 0
    })
  }

  const updateResizePreview = (
    next: ActiveTransform,
    drag: ResizeDragState,
    event: PointerEvent
  ) => {
    const update = buildResizeUpdate({
      drag,
      currentScreen: {
        x: event.clientX,
        y: event.clientY
      },
      zoom: instance.viewport.get().zoom,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      excludeNodeIds: next.targets.map((target) => target.id)
    })

    next.patches = next.targets.length === 1
      ? [{
          id: next.targets[0]!.id,
          position: update.position,
          size: update.size
        }]
      : projectResizePatches({
          startRect: getResizeStartRect(drag),
          nextRect: getResizeUpdateRect(update),
          members: next.targets
        })

    writePreview(next.patches)
  }

  const updateRotatePreview = (
    next: ActiveTransform,
    drag: RotateDragState,
    event: PointerEvent
  ) => {
    instance.internals.snap.node.clear()
    const rotation = computeNextRotation({
      center: drag.center,
      currentPoint: instance.viewport.pointer(event).world,
      startAngle: drag.startAngle,
      startRotation: drag.startRotation,
      shiftKey: event.shiftKey
    })
    next.patches = [{
      id: next.targets[0]!.id,
      rotation
    }]
    writePreview(next.patches)
  }

  const updatePreview = (
    next: ActiveTransform,
    event: PointerEvent
  ) => {
    if (next.drag.mode === 'resize') {
      updateResizePreview(next, next.drag, event)
      return
    }

    updateRotatePreview(next, next.drag, event)
  }

  const commit = (next: ActiveTransform) => {
    if (!next.patches?.length) {
      return
    }

    const commitTargetIds = next.commitTargetIds
      ?? new Set(next.targets.map((target) => target.id))
    const targetById = new Map(
      next.targets.map((target) => [target.id, target] as const)
    )
    const updates = next.patches.flatMap((preview) => {
      if (!commitTargetIds.has(preview.id)) {
        return []
      }

      const target = targetById.get(preview.id)
      if (!target) {
        return []
      }

      const patch = toPatch(target.node, preview)
      if (!patch) {
        return []
      }

      return [{
        id: target.id,
        patch
      }]
    })

    if (!updates.length) {
      return
    }

    instance.commands.node.updateMany(updates)
  }

  const canStart = () => !active

  const start = (
    next: ActiveTransform,
    event: TransformPointerEvent,
    capture: Element
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'node-transform',
      pointerId: event.pointerId,
      capture,
      cleanup: clear,
      move: (event) => {
        if (!active) {
          return
        }
        updatePreview(active, event)
      },
      up: (_event, session) => {
        if (!active) {
          return
        }

        commit(active)
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    active = next
    session = nextSession
    clearNodeSessionPreview(instance.internals.node.session)
    instance.internals.snap.node.clear()
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  const createNodeActive = (
    nodeId: NodeId,
    handle: TransformPickHandle,
    event: TransformPointerEvent
  ): ActiveTransform | undefined => {
    const nodeRect = instance.read.index.node.get(nodeId)
    if (!nodeRect || nodeRect.node.locked) {
      return
    }

    const transform = instance.read.node.transform(nodeRect.node)
    const target: TransformTarget = {
      id: nodeRect.node.id,
      node: nodeRect.node,
      rect: nodeRect.rect
    }
    const startScreen = {
      x: event.clientX,
      y: event.clientY
    }

    if (handle.kind === 'resize') {
      if (!handle.direction || !transform.resize) {
        return
      }
      return {
        targets: [target],
        drag: createResizeDrag({
          pointerId: event.pointerId,
          handle: handle.direction,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation,
          startScreen
        })
      }
    }

    if (!transform.rotate) {
      return
    }

    return {
      targets: [target],
      drag: createRotateDrag({
        pointerId: event.pointerId,
        rect: nodeRect.rect,
        rotation: nodeRect.rotation,
        start: instance.viewport.pointer(event).world
      })
    }
  }

  const createSelectionScaleTargets = (
    selectionNodeIds: readonly NodeId[]
  ) => {
    const resolved = instance.read.node.transformTargets(selectionNodeIds)
    if (!resolved?.targets.length) {
      return undefined
    }

    return {
      targets: resolved.targets as readonly TransformTarget[],
      commitTargetIds: resolved.commitIds
    }
  }

  const createSelectionActive = (
    handle: TransformPickHandle,
    event: TransformPointerEvent
  ): ActiveTransform | undefined => {
    const selection = instance.read.selection.get()
    const selectionBox = resolveSelectionBoxView(selection)
    if (
      !selectionBox.box
      || handle.kind !== 'resize'
      || !handle.direction
      || !selectionBox.canResize
    ) {
      return
    }

    const scaleTargets = createSelectionScaleTargets(selection.target.nodeIds)
    if (!scaleTargets) {
      return
    }

    return {
      targets: scaleTargets.targets,
      commitTargetIds: scaleTargets.commitTargetIds,
      drag: createResizeDrag({
        pointerId: event.pointerId,
        handle: handle.direction,
        rect: selectionBox.box,
        rotation: 0,
        startScreen: {
          x: event.clientX,
          y: event.clientY
        }
      })
    }
  }

  return {
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }
      clear()
    },
    down: (
      input: CanvasFrameDown
    ) => {
      const { event } = input

      if (!canStart()) {
        return false
      }

      const pick = input.pick

      if (
        pick.kind === 'node'
        && pick.part === 'transform'
        && pick.handle
      ) {
        const next = createNodeActive(pick.id, pick.handle, event)
        if (!next) {
          return false
        }

        return start(next, event, input.capture)
      }

      if (
        pick.kind === 'selection-box'
        && pick.part === 'transform'
        && pick.handle
      ) {
        const next = createSelectionActive(pick.handle, event)
        if (!next) {
          return false
        }

        return start(next, event, input.capture)
      }

      return false
    }
  }
}

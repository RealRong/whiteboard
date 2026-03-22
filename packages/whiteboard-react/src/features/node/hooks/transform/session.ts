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
import type { InternalInstance } from '../../../../runtime/instance'

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
  drag: TransformDragState
  patches?: readonly TransformPreviewPatch[]
}

type TransformPointerEvent = ReactPointerEvent<HTMLDivElement>

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
  node: Pick<Node, 'position' | 'size' | 'rotation'>,
  preview: TransformPreviewPatch
) => {
  const patch: NodePatch = {}

  if (preview.position && !isPointEqual(preview.position, node.position)) {
    patch.position = preview.position
  }
  if (preview.size && !isSizeEqual(preview.size, node.size)) {
    patch.size = preview.size
  }
  if (
    typeof preview.rotation === 'number'
    && preview.rotation !== (node.rotation ?? 0)
  ) {
    patch.rotation = preview.rotation
  }

  if (!patch.position && !patch.size && patch.rotation === undefined) {
    return undefined
  }

  return patch
}

const toTarget = (
  instance: InternalInstance,
  nodeId: NodeId
): TransformTarget | undefined => {
  const item = instance.read.node.item.get(nodeId)
  if (!item) {
    return undefined
  }

  return {
    id: item.node.id,
    node: item.node,
    rect: item.rect
  }
}

export const createTransformSession = (
  instance: InternalInstance
) => {
  let active: ActiveTransform | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const clear = () => {
    active = null
    session = null
    instance.internals.node.session.clear()
    instance.internals.snap.clear()
  }

  const writePreview = (
    patches: readonly TransformPreviewPatch[]
  ) => {
    instance.internals.node.session.write({
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

    return instance.internals.snap.resize({
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
    instance.internals.snap.clear()
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

    const targetById = new Map(
      next.targets.map((target) => [target.id, target] as const)
    )
    const updates = next.patches.flatMap((preview) => {
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

  const canStart = (
    event: TransformPointerEvent
  ) => (
    event.button === 0
    && !active
    && instance.read.tool.is('select')
  )

  const start = (
    next: ActiveTransform,
    event: TransformPointerEvent
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'node-transform',
      pointerId: event.pointerId,
      capture: event.currentTarget,
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
    instance.internals.node.session.clear()
    instance.internals.snap.clear()
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  const createNodeActive = (
    nodeId: NodeId,
    handle: TransformHandle,
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

  const createSelectionActive = (
    handle: TransformHandle,
    event: TransformPointerEvent
  ): ActiveTransform | undefined => {
    const selection = instance.read.selection.get()
    if (
      selection.items.count <= 1
      || !selection.box
      || handle.kind !== 'resize'
      || !handle.direction
      || selection.transform.resize === 'none'
    ) {
      return
    }

    const targets = selection.target.nodeIds
      .map((nodeId) => toTarget(instance, nodeId))
      .filter((target): target is TransformTarget => Boolean(target))
    if (targets.length !== selection.target.nodeIds.length) {
      return
    }

    return {
      targets,
      drag: createResizeDrag({
        pointerId: event.pointerId,
        handle: handle.direction,
        rect: selection.box,
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
    handleNodePointerDown: (
      nodeId: NodeId,
      handle: TransformHandle,
      event: TransformPointerEvent
    ) => {
      if (!canStart(event)) {
        return
      }

      const next = createNodeActive(nodeId, handle, event)
      if (!next) {
        return
      }

      start(next, event)
    },
    handleSelectionPointerDown: (
      handle: TransformHandle,
      event: TransformPointerEvent
    ) => {
      if (!canStart(event)) {
        return
      }

      const next = createSelectionActive(handle, event)
      if (!next) {
        return
      }

      start(next, event)
    }
  }
}

import {
  getRectCenter
} from '@whiteboard/core/geometry'
import {
  computeNextRotation,
  computeResizeRect,
  getResizeSourceEdges,
  getResizeUpdateRect,
  projectResizePatches,
  toTransformCommitPatch,
  type ResizeDirection,
  type TransformHandle,
  type TransformPreviewPatch
} from '@whiteboard/core/node'
import type { SelectionSummary } from '@whiteboard/core/selection'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { PointerDown } from '../../../runtime/input/pointer'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { FeatureRuntime } from '../../../runtime/editor/featureRuntime'

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

type TransformPickHandle = Pick<TransformHandle, 'kind' | 'direction'>

const resolveSelectionBoxView = (
  selection: SelectionSummary
) => {
  const box = selection.box
  const canResize = selection.transform.resize === 'scale'

  return {
    box,
    interactive: selection.boxInteractive,
    frame: Boolean(box) && selection.items.nodeCount > 0,
    handles: Boolean(box) && canResize,
    canResize
  }
}

export type NodeTransformInteraction = {
  interaction: InteractionRegistration<ActiveTransform>
  clear: () => void
}

type NodeTransformInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

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

export const createNodeTransformInteraction = (
  ctx: NodeTransformInteractionDeps
): NodeTransformInteraction => {
  const clear = () => {
    ctx.output.node.set((current) => (
      current.patches.length === 0 && current.hovered === undefined
        ? current
        : {
            ...current,
            patches: [],
            hovered: undefined
          }
    ))
    ctx.output.snap.node.clear()
  }

  const writePreview = (
    patches: readonly TransformPreviewPatch[]
  ) => {
    ctx.output.node.set((current) => ({
      ...current,
      patches: patches.map(({ id, position, size, rotation }) => ({
        id,
        patch: {
          position,
          size,
          rotation
        }
      })),
      hovered: undefined
    }))
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

    return ctx.output.snap.node.resize({
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
    state: ActiveTransform,
    drag: ResizeDragState,
    input: InteractionPointerInput
  ) => {
    const update = buildResizeUpdate({
      drag,
      currentScreen: input.screen,
      zoom: ctx.viewport.get().zoom,
      altKey: input.altKey,
      shiftKey: input.shiftKey,
      excludeNodeIds: state.targets.map((target) => target.id)
    })

    state.patches = state.targets.length === 1
      ? [{
          id: state.targets[0]!.id,
          position: update.position,
          size: update.size
        }]
      : projectResizePatches({
          startRect: getResizeStartRect(drag),
          nextRect: getResizeUpdateRect(update),
          members: state.targets
        })

    writePreview(state.patches)
  }

  const updateRotatePreview = (
    state: ActiveTransform,
    drag: RotateDragState,
    input: InteractionPointerInput
  ) => {
    ctx.output.snap.node.clear()
    const rotation = computeNextRotation({
      center: drag.center,
      currentPoint: input.world,
      startAngle: drag.startAngle,
      startRotation: drag.startRotation,
      shiftKey: input.shiftKey
    })
    state.patches = [{
      id: state.targets[0]!.id,
      rotation
    }]
    writePreview(state.patches)
  }

  const updatePreview = (
    state: ActiveTransform,
    input: InteractionPointerInput
  ) => {
    if (state.drag.mode === 'resize') {
      updateResizePreview(state, state.drag, input)
      return
    }

    updateRotatePreview(state, state.drag, input)
  }

  const commit = (state: ActiveTransform) => {
    if (!state.patches?.length) {
      return
    }

    const commitTargetIds = state.commitTargetIds
      ?? new Set(state.targets.map((target) => target.id))
    const targetById = new Map(
      state.targets.map((target) => [target.id, target] as const)
    )
    const updates = state.patches.flatMap((preview) => {
      if (!commitTargetIds.has(preview.id)) {
        return []
      }

      const target = targetById.get(preview.id)
      if (!target) {
        return []
      }

      const patch = toTransformCommitPatch(target.node, preview)
      if (!patch) {
        return []
      }

      return [{
        id: target.id,
        update: {
          fields: patch
        }
      }]
    })

    if (!updates.length) {
      return
    }

    ctx.command.node.document.updateMany(updates)
  }

  const createNodeActive = (
    nodeId: NodeId,
    handle: TransformPickHandle,
    input: PointerDown
  ): ActiveTransform | undefined => {
    const nodeRect = ctx.query.read.index.node.get(nodeId)
    if (!nodeRect || nodeRect.node.locked) {
      return undefined
    }

    const transform = ctx.query.read.node.transform(nodeRect.node)
    const target: TransformTarget = {
      id: nodeRect.node.id,
      node: nodeRect.node,
      rect: nodeRect.rect
    }
    const startScreen = {
      x: input.point.client.x,
      y: input.point.client.y
    }

    if (handle.kind === 'resize') {
      if (!handle.direction || !transform.resize) {
        return undefined
      }
      return {
        targets: [target],
        drag: createResizeDrag({
          pointerId: input.pointerId,
          handle: handle.direction,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation,
          startScreen
        })
      }
    }

    if (!transform.rotate) {
      return undefined
    }

    return {
      targets: [target],
      drag: createRotateDrag({
        pointerId: input.pointerId,
        rect: nodeRect.rect,
        rotation: nodeRect.rotation,
        start: input.point.world
      })
    }
  }

  const createSelectionScaleTargets = (
    selectionNodeIds: readonly NodeId[]
  ) => {
    const resolved = ctx.query.read.node.transformTargets(selectionNodeIds)
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
    input: PointerDown
  ): ActiveTransform | undefined => {
    const selection = ctx.query.read.selection.get().summary
    const selectionBox = resolveSelectionBoxView(selection)
    if (
      !selectionBox.box
      || handle.kind !== 'resize'
      || !handle.direction
      || !selectionBox.canResize
    ) {
      return undefined
    }

    const scaleTargets = createSelectionScaleTargets(selection.target.nodeIds)
    if (!scaleTargets) {
      return undefined
    }

    return {
      targets: scaleTargets.targets,
      commitTargetIds: scaleTargets.commitTargetIds,
      drag: createResizeDrag({
        pointerId: input.pointerId,
        handle: handle.direction,
        rect: selectionBox.box,
        rotation: 0,
        startScreen: {
          x: input.point.client.x,
          y: input.point.client.y
        }
      })
    }
  }

  const interaction: InteractionRegistration<ActiveTransform> = {
    key: 'node.transform',
    priority: 400,
    mode: 'node-transform',
    can: (input) => {
      if (
        input.tool.type !== 'select'
        || (input.pick.kind !== 'node' && input.pick.kind !== 'selection-box')
        || input.pick.part !== 'transform'
        || !input.pick.handle
      ) {
        return null
      }

      if (input.pick.kind === 'node') {
        return createNodeActive(input.pick.id, input.pick.handle, input) ?? null
      }

      return createSelectionActive(input.pick.handle, input) ?? null
    },
    start: ({ input }) => {
      clear()
    },
    move: ({ state }, input) => {
      updatePreview(state, input)
    },
    up: ({ state, session }) => {
      commit(state)
      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    interaction,
    clear
  }
}

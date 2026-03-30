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
import type { EditorRuntime } from '../../../types/internal/editor'
import type { PointerDown } from '../../../runtime/input/pointer'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { SnapRuntime } from '../../../runtime/interaction'
import type { NodeProjectionRuntime } from '../projection/store'

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
  EditorRuntime,
  'commands' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      model: {
        node: Pick<NodeProjectionRuntime, 'preview'>
      }
    }
    snap: Pick<SnapRuntime, 'node'>
  }
}

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
  editor: NodeTransformInteractionDeps
): NodeTransformInteraction => {
  const clear = () => {
    editor.internals.projections.model.node.preview.clear()
    editor.internals.snap.node.clear()
  }

  const writePreview = (
    patches: readonly TransformPreviewPatch[]
  ) => {
    editor.internals.projections.model.node.preview.write({
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

    return editor.internals.snap.node.resize({
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
      zoom: editor.viewport.get().zoom,
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
    editor.internals.snap.node.clear()
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

    editor.commands.node.document.updateMany(updates)
  }

  const createNodeActive = (
    nodeId: NodeId,
    handle: TransformPickHandle,
    event: PointerDown['event']
  ): ActiveTransform | undefined => {
    const nodeRect = editor.read.index.node.get(nodeId)
    if (!nodeRect || nodeRect.node.locked) {
      return undefined
    }

    const transform = editor.read.node.transform(nodeRect.node)
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
        return undefined
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
      return undefined
    }

    return {
      targets: [target],
      drag: createRotateDrag({
        pointerId: event.pointerId,
        rect: nodeRect.rect,
        rotation: nodeRect.rotation,
        start: editor.viewport.pointer(event).world
      })
    }
  }

  const createSelectionScaleTargets = (
    selectionNodeIds: readonly NodeId[]
  ) => {
    const resolved = editor.read.node.transformTargets(selectionNodeIds)
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
    event: PointerDown['event']
  ): ActiveTransform | undefined => {
    const selection = editor.read.selection.get()
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
        return createNodeActive(input.pick.id, input.pick.handle, input.event) ?? null
      }

      return createSelectionActive(input.pick.handle, input.event) ?? null
    },
    start: ({ input }) => {
      clear()
      input.event.preventDefault()
      input.event.stopPropagation()
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

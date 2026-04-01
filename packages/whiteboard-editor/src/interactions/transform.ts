import { getRectCenter } from '@whiteboard/core/geometry'
import {
  buildTransformCommitUpdates,
  computeNextRotation,
  computeResizeRect,
  getResizeSourceEdges,
  getResizeUpdateRect,
  projectResizeTransformPatches,
  projectRotateTransformPatches,
  type Guide,
  type ResizeDirection,
  type TransformHandle,
  type TransformPreviewPatch
} from '@whiteboard/core/node'
import type { SelectionSummary } from '@whiteboard/core/selection'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type {
  InteractionControl,
  InteractionOwner,
  InteractionSession
} from '../runtime/interaction'
import type {
  InteractionCtx
} from '../runtime/interaction'
import type {
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput
} from '../types/input'

type TransformInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

type SessionPointer = PointerMoveInput | PointerUpInput

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

export type TransformState = {
  targets: readonly TransformTarget[]
  commitTargetIds?: ReadonlySet<NodeId>
  drag: TransformDragState
  patches?: readonly TransformPreviewPatch[]
}

type TransformPickHandle = Pick<TransformHandle, 'kind' | 'direction'>

const writeSnapGuides = (
  ctx: TransformInteractionCtx,
  guides: readonly Guide[]
) => {
  ctx.overlay.set((current) => ({
    ...current,
    selection: {
      ...current.selection,
      guides
    }
  }))
}

const clearSnapGuides = (
  ctx: TransformInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.selection.guides.length === 0
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            guides: []
          }
        }
  ))
}

const resolveSelectionBoxView = (
  selection: SelectionSummary
) => {
  const box = selection.box
  const canResize = selection.transform.resize === 'scale'

  return {
    box,
    frame: Boolean(box) && selection.items.nodeCount > 0,
    handles: Boolean(box) && canResize,
    canResize
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

const writeTransformPreview = (
  ctx: TransformInteractionCtx,
  patches: readonly TransformPreviewPatch[]
) => {
  ctx.overlay.set((current) => ({
    ...current,
    selection: {
      ...current.selection,
      node: {
        patches: patches.map(({ id, position, size, rotation }) => ({
          id,
          patch: {
            position,
            size,
            rotation
          }
        })),
        hovered: undefined
      }
    }
  }))
}

const computeResizeUpdate = (
  ctx: TransformInteractionCtx,
  options: {
    drag: ResizeDragState
    currentScreen: Point
    zoom: number
    altKey: boolean
    shiftKey: boolean
    excludeNodeIds: readonly NodeId[]
  }
) => {
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

  const snapped = ctx.snap.node.resize({
    rect: rawRect.rect,
    source: {
      x: sourceX,
      y: sourceY
    },
    minSize: RESIZE_MIN_SIZE,
    excludeIds: options.excludeNodeIds,
    disabled: options.altKey || options.drag.startRotation !== 0
  })

  return {
    guides: snapped.guides,
    update: snapped.update
  }
}

const clearNodeTransform = (
  ctx: TransformInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.selection.node.patches.length === 0
      && current.selection.node.hovered === undefined
      && current.selection.guides.length === 0
    )
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            node: {
              patches: [],
              hovered: undefined
            },
            guides: []
          }
        }
  ))
}

const gatherNodeTransformTarget = (
  ctx: TransformInteractionCtx,
  nodeId: NodeId,
  handle: TransformPickHandle,
  input: PointerDownInput
): TransformState | undefined => {
  const nodeRect = ctx.read.index.node.get(nodeId)
  if (!nodeRect || nodeRect.node.locked) {
    return undefined
  }

  const capability = ctx.read.node.capability(nodeRect.node)
  const target: TransformTarget = {
    id: nodeRect.node.id,
    node: nodeRect.node,
    rect: nodeRect.rect
  }
  const startScreen = {
    x: input.client.x,
    y: input.client.y
  }

  if (handle.kind === 'resize') {
    if (!handle.direction || !capability.resize) {
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

  if (!capability.rotate) {
    return undefined
  }

  return {
    targets: [target],
    drag: createRotateDrag({
      pointerId: input.pointerId,
      rect: nodeRect.rect,
      rotation: nodeRect.rotation,
      start: input.world
    })
  }
}

const gatherSelectionScaleTargets = (
  ctx: TransformInteractionCtx,
  selectionNodeIds: readonly NodeId[]
) => {
  const resolved = ctx.read.node.transformTargets(selectionNodeIds)
  if (!resolved?.targets.length) {
    return undefined
  }

  return {
    targets: resolved.targets as readonly TransformTarget[],
    commitTargetIds: resolved.commitIds
  }
}

const gatherSelectionTransformTarget = (
  ctx: TransformInteractionCtx,
  handle: TransformPickHandle,
  input: PointerDownInput
): TransformState | undefined => {
  const selection = ctx.read.selection.summary.get()
  const selectionBox = resolveSelectionBoxView(selection)
  if (
    !selectionBox.box
    || handle.kind !== 'resize'
    || !handle.direction
    || !selectionBox.canResize
  ) {
    return undefined
  }

  const scaleTargets = gatherSelectionScaleTargets(ctx, selection.target.nodeIds)
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
        x: input.client.x,
        y: input.client.y
      }
    })
  }
}

export const gatherTransformState = (
  ctx: TransformInteractionCtx,
  input: PointerDownInput
): TransformState | null => {
  const tool = ctx.read.tool.get()

  if (
    tool.type !== 'select'
    || (input.pick.kind !== 'node' && input.pick.kind !== 'selection-box')
    || input.pick.part !== 'transform'
    || !input.pick.handle
  ) {
    return null
  }

  if (input.pick.kind === 'node') {
    return gatherNodeTransformTarget(ctx, input.pick.id, input.pick.handle, input) ?? null
  }

  return gatherSelectionTransformTarget(ctx, input.pick.handle, input) ?? null
}

const computeResizeTransformProjection = (
  ctx: TransformInteractionCtx,
  state: TransformState,
  drag: ResizeDragState,
  input: SessionPointer
) => {
  const { guides, update } = computeResizeUpdate(ctx, {
    drag,
    currentScreen: input.screen,
    zoom: ctx.state.viewport.read.get().zoom,
    altKey: input.modifiers.alt,
    shiftKey: input.modifiers.shift,
    excludeNodeIds: state.targets.map((target) => target.id)
  })

  return {
    guides,
    patches: projectResizeTransformPatches({
      startRect: getResizeStartRect(drag),
      nextRect: getResizeUpdateRect(update),
      targets: state.targets
    })
  }
}

const applyResizeTransformProjection = (
  ctx: TransformInteractionCtx,
  state: TransformState,
  projection: ReturnType<typeof computeResizeTransformProjection>
) => {
  state.patches = projection.patches
  writeSnapGuides(ctx, projection.guides)
  writeTransformPreview(ctx, projection.patches)
}

const computeRotateTransformProjection = (
  state: TransformState,
  drag: RotateDragState,
  input: SessionPointer
) => {
  const rotation = computeNextRotation({
    center: drag.center,
    currentPoint: input.world,
    startAngle: drag.startAngle,
    startRotation: drag.startRotation,
    shiftKey: input.modifiers.shift
  })

  return projectRotateTransformPatches({
    targetId: state.targets[0]!.id,
    rotation
  })
}

const applyRotateTransformProjection = (
  ctx: TransformInteractionCtx,
  state: TransformState,
  patches: ReturnType<typeof computeRotateTransformProjection>
) => {
  state.patches = patches
  clearSnapGuides(ctx)
  writeTransformPreview(ctx, patches)
}

const projectTransformPreview = (
  ctx: TransformInteractionCtx,
  state: TransformState,
  input: SessionPointer
) => {
  if (state.drag.mode === 'resize') {
    applyResizeTransformProjection(
      ctx,
      state,
      computeResizeTransformProjection(ctx, state, state.drag, input)
    )
    return
  }

  applyRotateTransformProjection(
    ctx,
    state,
    computeRotateTransformProjection(state, state.drag, input)
  )
}

const commitTransform = (
  ctx: TransformInteractionCtx,
  state: TransformState
) => {
  if (!state.patches?.length) {
    return
  }

  const updates = buildTransformCommitUpdates({
    targets: state.targets,
    patches: state.patches,
    commitTargetIds: state.commitTargetIds
  })

  if (!updates.length) {
    return
  }

  ctx.commands.node.document.updateMany(updates)
}

const createTransformSession = (
  ctx: TransformInteractionCtx,
  state: TransformState,
  control: InteractionControl
): InteractionSession => {
  clearNodeTransform(ctx)

  return {
    mode: 'node-transform',
    pointerId: state.drag.pointerId,
    chrome: false,
    move: (next) => {
      projectTransformPreview(ctx, state, next)
    },
    up: () => {
      commitTransform(ctx, state)
      control.finish()
    },
    cleanup: () => {
      clearNodeTransform(ctx)
    }
  }
}

export const createTransformInteraction = (
  ctx: TransformInteractionCtx
): {
  owner: InteractionOwner
  clear: () => void
} => ({
  owner: {
    key: 'transform',
    priority: 120,
    start: (input, control) => {
      const state = gatherTransformState(ctx, input)
      return state
        ? createTransformSession(ctx, state, control)
        : null
    }
  },
  clear: () => {
    clearNodeTransform(ctx)
  }
})

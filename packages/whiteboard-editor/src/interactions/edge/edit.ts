import {
  moveEdge,
  moveRoutePoint
} from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type {
  EdgeId,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { PointerDown } from '../../runtime/input/pointer'
import type {
  ActiveInteraction,
  InteractionControl,
} from '../../runtime/interaction'
import type { InteractionHost } from '../../runtime/interaction/host'

type BodyMoveState = {
  kind: 'move'
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
}

type RouteDragState = {
  kind: 'drag'
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

type BodyState =
  | BodyMoveState
  | {
      kind: 'insert'
      edgeId: EdgeId
    }

type RouteState =
  | RouteDragState
  | {
      kind: 'insert'
      edgeId: EdgeId
      worldPoint: Point
    }
  | {
      kind: 'remove'
      edgeId: EdgeId
      index: number
    }

type EdgeRoutePick = Extract<PointerDown['pick'], {
  kind: 'edge'
}> & {
  part: 'path'
}

type RoutePoint =
  | {
      kind: 'anchor'
      edgeId: EdgeId
      index: number
      point: Point
    }
  | {
      kind: 'insert'
      edgeId: EdgeId
      insertIndex: number
      point: Point
    }

type EdgeEditInteractionDeps = Pick<
  InteractionHost,
  'read' | 'commands' | 'viewport' | 'overlay'
>

const isEdgeRoutePick = (
  pick: PointerDown['pick']
): pick is EdgeRoutePick => (
  pick.kind === 'edge'
  && pick.part === 'path'
)

const readMovePatch = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId,
  delta: Point
): EdgePatch | undefined => {
  const item = ctx.read.edge.item.get(edgeId)
  if (!item || !ctx.read.edge.capability(item.edge).move) {
    return undefined
  }

  return moveEdge(item.edge, delta)
}

const writePreviewPatch = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId,
  patch: EdgePatch | undefined
) => {
  if (!patch) {
    ctx.overlay.set((current) => (
      current.edge.patches.length === 0
        ? current
        : {
            ...current,
            edge: {
              patches: []
            }
          }
    ))
    return
  }

  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      patches: [{
        id: edgeId,
        patch
      }]
    }
  }))
}

const readRouteView = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId
) => ctx.read.edge.resolved.get(edgeId)

const readCapability = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId
) => {
  const item = ctx.read.edge.item.get(edgeId)
  return item
    ? ctx.read.edge.capability(item.edge)
    : undefined
}

const readRouteOrigin = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId,
  index: number
) => {
  const view = readRouteView(ctx, edgeId)
  if (!view || !readCapability(ctx, edgeId)?.editRoute) {
    return undefined
  }

  const handle = view.handles.find((entry) => (
    entry.kind === 'anchor'
    && entry.index === index
  ))

  return handle?.kind === 'anchor'
    ? handle.point
    : undefined
}

const readRoutePoint = (
  ctx: EdgeEditInteractionDeps,
  pick: EdgeRoutePick
): RoutePoint | undefined => {
  const view = readRouteView(ctx, pick.id)
  if (!view || !readCapability(ctx, pick.id)?.editRoute) {
    return undefined
  }

  if (pick.index !== undefined) {
    const handle = view.handles.find((entry) => (
      entry.kind === 'anchor'
      && entry.index === pick.index
    ))
    if (!handle || handle.kind !== 'anchor') {
      return undefined
    }

    return {
      kind: 'anchor',
      edgeId: pick.id,
      index: handle.index,
      point: handle.point
    }
  }

  const insertIndex = pick.insert ?? 0
  const handle = view.handles.find((entry) => (
    entry.kind === 'insert'
    && entry.insertIndex === insertIndex
  ))
  if (!handle || handle.kind !== 'insert') {
    return undefined
  }

  return {
    kind: 'insert',
    edgeId: pick.id,
    insertIndex: handle.insertIndex,
    point: handle.point
  }
}

const writeRoutePreview = (
  ctx: EdgeEditInteractionDeps,
  edgeId: EdgeId,
  patch?: EdgePatch,
  activeRouteIndex?: number
) => {
  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      patches: [{
        id: edgeId,
        patch,
        activeRouteIndex
      }]
    }
  }))
}

const updateBodyMove = (
  ctx: EdgeEditInteractionDeps,
  state: BodyMoveState,
  input: {
    clientX: number
    clientY: number
  }
) => {
  const { world } = ctx.viewport.pointer(input)
  const delta = {
    x: world.x - state.start.x,
    y: world.y - state.start.y
  }
  if (isPointEqual(delta, state.delta)) {
    return
  }

  state.delta = delta
  const patch = readMovePatch(ctx, state.edgeId, delta)
  if (!patch) {
    return
  }

  writePreviewPatch(ctx, state.edgeId, patch)
}

const commitBodyMove = (
  ctx: EdgeEditInteractionDeps,
  state: BodyMoveState
) => {
  if (!isPointEqual(state.delta, { x: 0, y: 0 })) {
    ctx.commands.edge.move(state.edgeId, state.delta)
    ctx.commands.selection.clear()
  }
}

const updateRouteDrag = (
  ctx: EdgeEditInteractionDeps,
  state: RouteDragState,
  input: {
    clientX: number
    clientY: number
  }
) => {
  const item = ctx.read.edge.item.get(state.edgeId)
  if (!item || !readCapability(ctx, state.edgeId)?.editRoute) {
    return false
  }

  const { world } = ctx.viewport.pointer(input)
  const point = {
    x: state.origin.x + (world.x - state.start.x),
    y: state.origin.y + (world.y - state.start.y)
  }
  if (isPointEqual(point, state.point)) {
    return true
  }

  state.point = point
  const patch = moveRoutePoint(item.edge, state.index, point)
  if (!patch) {
    return false
  }

  writeRoutePreview(ctx, state.edgeId, patch, state.index)
  return true
}

const commitRouteDrag = (
  ctx: EdgeEditInteractionDeps,
  state: RouteDragState
) => {
  if (
    readCapability(ctx, state.edgeId)?.editRoute
    && !isPointEqual(state.point, state.origin)
  ) {
    ctx.commands.edge.route.move(state.edgeId, state.index, state.point)
  }
}

const createBodyActive = (
  ctx: EdgeEditInteractionDeps,
  state: BodyMoveState,
  control: InteractionControl
): ActiveInteraction => ({
  mode: 'edge-drag',
  pointerId: state.pointerId,
  autoPan: {
    frame: (pointer) => {
      updateBodyMove(ctx, state, pointer)
    }
  },
  move: (input) => {
    updateBodyMove(ctx, state, {
      clientX: input.client.x,
      clientY: input.client.y
    })
    control.pan({
      clientX: input.client.x,
      clientY: input.client.y
    })
  },
  up: () => {
    commitBodyMove(ctx, state)
    control.finish()
  },
  cleanup: () => {
    ctx.overlay.set((current) => (
      current.edge.patches.length === 0
        ? current
        : {
            ...current,
            edge: {
              patches: []
            }
          }
    ))
  }
})

const createRouteActive = (
  ctx: EdgeEditInteractionDeps,
  initialState: RouteState,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction => {
  let state = initialState

  if (state.kind === 'remove') {
    ctx.commands.edge.route.remove(state.edgeId, state.index)
    control.finish()

    return {
      mode: 'edge-route',
      cleanup: () => {
        ctx.overlay.set((current) => (
          current.edge.patches.length === 0
            ? current
            : {
                ...current,
                edge: {
                  patches: []
                }
              }
        ))
      }
    }
  }

  if (state.kind === 'insert') {
    const result = ctx.commands.edge.route.insert(state.edgeId, state.worldPoint)
    if (!result.ok) {
      control.finish()

      return {
        mode: 'edge-route',
        cleanup: () => {
          ctx.overlay.set((current) => (
            current.edge.patches.length === 0
              ? current
              : {
                  ...current,
                  edge: {
                    patches: []
                  }
                }
          ))
        }
      }
    }

    const origin = readRouteOrigin(ctx, state.edgeId, result.data.index) ?? state.worldPoint
    state = {
      kind: 'drag',
      edgeId: state.edgeId,
      index: result.data.index,
      pointerId: input.pointerId,
      start: input.point.world,
      origin,
      point: origin
    }
  }

  if (state.kind === 'drag') {
    writeRoutePreview(ctx, state.edgeId, undefined, state.index)
  }

  return {
    mode: 'edge-route',
    pointerId: state.kind === 'drag' ? state.pointerId : undefined,
    autoPan: {
      frame: (pointer) => {
        if (state.kind !== 'drag') {
          return
        }

        updateRouteDrag(ctx, state, pointer)
      }
    },
    move: (nextInput) => {
      if (state.kind !== 'drag') {
        return
      }

      if (!updateRouteDrag(ctx, state, {
        clientX: nextInput.client.x,
        clientY: nextInput.client.y
      })) {
        control.cancel()
        return
      }

      control.pan({
        clientX: nextInput.client.x,
        clientY: nextInput.client.y
      })
    },
    up: () => {
      if (state.kind === 'drag') {
        commitRouteDrag(ctx, state)
      }

      control.finish()
    },
    cleanup: () => {
      ctx.overlay.set((current) => (
        current.edge.patches.length === 0
          ? current
          : {
              ...current,
              edge: {
                patches: []
              }
            }
      ))
    }
  }
}

export const startEdgeBodyPhase = (
  ctx: EdgeEditInteractionDeps,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction | null => {
  if (
    input.tool.type !== 'select'
    || input.pick.kind !== 'edge'
    || input.pick.part !== 'body'
  ) {
    return null
  }

  const capability = readCapability(ctx, input.pick.id)
  if (!capability) {
    return null
  }

  const state: BodyState | null =
    input.shiftKey || input.detail >= 2
      ? capability.editRoute
        ? {
            kind: 'insert',
            edgeId: input.pick.id
          }
        : null
      : capability.move
        ? {
            kind: 'move',
            edgeId: input.pick.id,
            pointerId: input.pointerId,
            start: input.point.world,
            delta: { x: 0, y: 0 }
          }
        : null
  if (!state) {
    return null
  }

  ctx.commands.selection.replace({
    edgeIds: [state.edgeId]
  })

  if (state.kind === 'insert') {
    ctx.commands.edge.route.insert(state.edgeId, input.point.world)
    control.finish()

    return {
      mode: 'edge-drag',
      cleanup: () => {
        ctx.overlay.set((current) => (
          current.edge.patches.length === 0
            ? current
            : {
                ...current,
                edge: {
                  patches: []
                }
              }
        ))
      }
    }
  }

  return createBodyActive(ctx, state, control)
}

export const startEdgeRoutePhase = (
  ctx: EdgeEditInteractionDeps,
  input: PointerDown,
  control: InteractionControl
): ActiveInteraction | null => {
  if (
    input.tool.type !== 'select'
    || !isEdgeRoutePick(input.pick)
  ) {
    return null
  }

  const routePoint = readRoutePoint(ctx, input.pick)
  if (!routePoint) {
    return null
  }

  const state: RouteState =
    routePoint.kind === 'insert'
      ? {
          kind: 'insert',
          edgeId: routePoint.edgeId,
          worldPoint: input.point.world
        }
      : input.detail >= 2
        ? {
            kind: 'remove',
            edgeId: routePoint.edgeId,
            index: routePoint.index
          }
        : {
            kind: 'drag',
            edgeId: routePoint.edgeId,
            index: routePoint.index,
            pointerId: input.pointerId,
            start: input.point.world,
            origin: routePoint.point,
            point: routePoint.point
          }

  return createRouteActive(ctx, state, input, control)
}

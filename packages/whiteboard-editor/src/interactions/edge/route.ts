import { isPointEqual } from '@whiteboard/core/geometry'
import {
  moveEdge,
  moveRoutePoint
} from '@whiteboard/core/edge'
import type { EdgeId } from '@whiteboard/core/types'
import type { InteractionControl, InteractionSession } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import { clearEdgePatches, writeRoutePreview } from './overlay'
import type {
  BodyMoveState,
  EdgeInteractionCtx,
  EdgeRoutePick,
  RouteDragState,
  RoutePoint,
  RouteState
} from './types'
import { readViewport } from './types'

const isEdgeRoutePick = (
  pick: PointerDownInput['pick']
): pick is EdgeRoutePick => (
  pick.kind === 'edge'
  && pick.part === 'path'
)

const readCapability = (
  ctx: EdgeInteractionCtx,
  edgeId: EdgeId
) => {
  const item = ctx.read.edge.item.get(edgeId)
  return item
    ? ctx.read.edge.capability(item.edge)
    : undefined
}

const readRouteView = (
  ctx: EdgeInteractionCtx,
  edgeId: EdgeId
) => ctx.read.edge.resolved.get(edgeId)

const readRouteOrigin = (
  ctx: EdgeInteractionCtx,
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
  ctx: EdgeInteractionCtx,
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

const updateBodyMove = (
  ctx: EdgeInteractionCtx,
  state: BodyMoveState,
  input: {
    clientX: number
    clientY: number
  }
) => {
  const { world } = readViewport(ctx).pointer(input)
  const delta = {
    x: world.x - state.start.x,
    y: world.y - state.start.y
  }
  if (isPointEqual(delta, state.delta)) {
    return
  }

  state.delta = delta
  const item = ctx.read.edge.item.get(state.edgeId)
  if (!item || !ctx.read.edge.capability(item.edge).move) {
    return
  }

  const patch = moveEdge(item.edge, delta)
  if (!patch) {
    return
  }

  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      ...current.edge,
      interaction: [{
        id: state.edgeId,
        patch
      }]
    }
  }))
}

const commitBodyMove = (
  ctx: EdgeInteractionCtx,
  state: BodyMoveState
) => {
  if (!isPointEqual(state.delta, { x: 0, y: 0 })) {
    ctx.commands.edge.move(state.edgeId, state.delta)
    ctx.commands.selection.clear()
  }
}

const updateRouteDrag = (
  ctx: EdgeInteractionCtx,
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

  const { world } = readViewport(ctx).pointer(input)
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
  ctx: EdgeInteractionCtx,
  state: RouteDragState
) => {
  if (
    readCapability(ctx, state.edgeId)?.editRoute
    && !isPointEqual(state.point, state.origin)
  ) {
    ctx.commands.edge.route.move(state.edgeId, state.index, state.point)
  }
}

export const startEdgeRouteSession = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput
): RouteState | null => {
  if (!isEdgeRoutePick(input.pick)) {
    return null
  }

  const routePoint = readRoutePoint(ctx, input.pick)
  if (!routePoint) {
    return null
  }

  return routePoint.kind === 'insert'
    ? {
        kind: 'insert',
        edgeId: routePoint.edgeId,
        worldPoint: input.world
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
          start: input.world,
          origin: routePoint.point,
          point: routePoint.point
        }
}

export const createMoveBodyInteraction = (
  ctx: EdgeInteractionCtx,
  state: BodyMoveState,
  control: InteractionControl
): InteractionSession => ({
  mode: 'edge-drag',
  pointerId: state.pointerId,
  autoPan: {
    frame: (pointer) => {
      updateBodyMove(ctx, state, pointer)
    }
  },
  move: (nextInput) => {
    updateBodyMove(ctx, state, {
      clientX: nextInput.client.x,
      clientY: nextInput.client.y
    })
    control.pan({
      clientX: nextInput.client.x,
      clientY: nextInput.client.y
    })
  },
  up: () => {
    commitBodyMove(ctx, state)
    control.finish()
  },
  cleanup: () => {
    clearEdgePatches(ctx)
  }
})

export const createRouteInteraction = (
  ctx: EdgeInteractionCtx,
  session: RouteState,
  input: PointerDownInput,
  control: InteractionControl
): InteractionSession => {
  let routeState = session

  if (routeState.kind === 'remove') {
    ctx.commands.edge.route.remove(routeState.edgeId, routeState.index)
    control.finish()

    return {
      mode: 'edge-route',
      cleanup: () => {
        clearEdgePatches(ctx)
      }
    }
  }

  if (routeState.kind === 'insert') {
    const result = ctx.commands.edge.route.insert(routeState.edgeId, routeState.worldPoint)
    if (!result.ok) {
      control.finish()

      return {
        mode: 'edge-route',
        cleanup: () => {
          clearEdgePatches(ctx)
        }
      }
    }

    const origin = readRouteOrigin(ctx, routeState.edgeId, result.data.index) ?? routeState.worldPoint
    routeState = {
      kind: 'drag',
      edgeId: routeState.edgeId,
      index: result.data.index,
      pointerId: input.pointerId,
      start: input.world,
      origin,
      point: origin
    }
  }

  writeRoutePreview(ctx, routeState.edgeId, undefined, routeState.index)

  return {
    mode: 'edge-route',
    pointerId: routeState.pointerId,
    autoPan: {
      frame: (pointer) => {
        updateRouteDrag(ctx, routeState, pointer)
      }
    },
    move: (nextInput) => {
      if (!updateRouteDrag(ctx, routeState, {
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
      commitRouteDrag(ctx, routeState)
      control.finish()
    },
    cleanup: () => {
      clearEdgePatches(ctx)
    }
  }
}

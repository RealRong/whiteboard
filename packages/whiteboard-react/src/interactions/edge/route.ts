import { isPointEqual } from '@whiteboard/core/geometry'
import {
  moveEdge,
  moveRoutePoint
} from '@whiteboard/core/edge'
import type { EdgeId } from '@whiteboard/core/types'
import type {
  InteractionControl,
  InteractionSession,
  InteractionStartResult
} from '../runtime'
import type { PointerDownInput } from '@whiteboard/editor'
import {
  clearEdgeOverlay,
  clearEdgePatches,
  writeEdgePatch
} from './overlay'
import type {
  BodyMoveSession,
  EdgeInteractionCtx,
  EdgeRoutePick,
  RouteDragSession,
  RoutePoint,
  RouteState
} from './types'

const HANDLED: InteractionStartResult = {
  kind: 'handled'
}

type PointerClient = {
  clientX: number
  clientY: number
}

const readViewport = (
  ctx: EdgeInteractionCtx
) => ctx.read.viewport

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

const projectBodyMove = (
  ctx: EdgeInteractionCtx,
  session: BodyMoveSession,
  input: PointerClient
) => {
  const item = ctx.read.edge.item.get(session.edgeId)
  if (!item || !ctx.read.edge.capability(item.edge).move) {
    return {
      ok: false as const,
      session
    }
  }

  const { world } = readViewport(ctx).pointer(input)
  const delta = {
    x: world.x - session.start.x,
    y: world.y - session.start.y
  }
  if (isPointEqual(delta, session.delta)) {
    return {
      ok: true as const,
      session
    }
  }

  return {
    ok: true as const,
    session: {
      ...session,
      delta
    },
    patch: moveEdge(item.edge, delta)
  }
}

const writeBodyMovePreview = (
  ctx: EdgeInteractionCtx,
  edgeId: EdgeId,
  patch: ReturnType<typeof moveEdge>
) => {
  writeEdgePatch(ctx, {
    edgeId,
    patch
  })
}

const commitBodyMove = (
  ctx: EdgeInteractionCtx,
  session: BodyMoveSession
) => {
  if (!isPointEqual(session.delta, { x: 0, y: 0 })) {
    ctx.commands.edge.move(session.edgeId, session.delta)
    ctx.commands.selection.clear()
  }
}

const createBodyMoveSession = (
  ctx: EdgeInteractionCtx,
  initial: BodyMoveSession,
  control: InteractionControl
): InteractionSession => {
  let session = initial

  const step = (
    input: PointerClient
  ) => {
    const result = projectBodyMove(ctx, session, input)
    if (!result.ok) {
      control.cancel()
      return false
    }

    if (result.session !== session) {
      session = result.session
      writeBodyMovePreview(ctx, session.edgeId, result.patch)
    }

    return true
  }

  return {
    mode: 'edge-drag',
    pointerId: session.pointerId,
    autoPan: {
      frame: (pointer) => {
        step(pointer)
      }
    },
    move: (input) => {
      if (!step({
        clientX: input.client.x,
        clientY: input.client.y
      })) {
        return
      }

      control.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: (input) => {
      if (!step({
        clientX: input.client.x,
        clientY: input.client.y
      })) {
        return
      }

      commitBodyMove(ctx, session)
      control.finish()
    },
    cleanup: () => {
      clearEdgePatches(ctx)
    }
  }
}

const projectRouteDrag = (
  ctx: EdgeInteractionCtx,
  session: RouteDragSession,
  input: PointerClient
) => {
  const item = ctx.read.edge.item.get(session.edgeId)
  if (!item || !readCapability(ctx, session.edgeId)?.editRoute) {
    return {
      ok: false as const,
      session
    }
  }

  const { world } = readViewport(ctx).pointer(input)
  const point = {
    x: session.origin.x + (world.x - session.start.x),
    y: session.origin.y + (world.y - session.start.y)
  }
  if (isPointEqual(point, session.point)) {
    return {
      ok: true as const,
      session
    }
  }

  return {
    ok: true as const,
    session: {
      ...session,
      point
    },
    patch: moveRoutePoint(item.edge, session.index, point)
  }
}

const writeRouteDragPreview = (
  ctx: EdgeInteractionCtx,
  session: RouteDragSession,
  patch: ReturnType<typeof moveRoutePoint>
) => {
  writeEdgePatch(ctx, {
    edgeId: session.edgeId,
    patch,
    activeRouteIndex: session.index
  })
}

const commitRouteDrag = (
  ctx: EdgeInteractionCtx,
  session: RouteDragSession
) => {
  if (
    readCapability(ctx, session.edgeId)?.editRoute
    && !isPointEqual(session.point, session.origin)
  ) {
    ctx.commands.edge.route.move(session.edgeId, session.index, session.point)
  }
}

const createRouteDragSession = (
  ctx: EdgeInteractionCtx,
  initial: RouteDragSession,
  control: InteractionControl
): InteractionSession => {
  let session = initial
  writeRouteDragPreview(ctx, session, undefined)

  const step = (
    input: PointerClient
  ) => {
    const result = projectRouteDrag(ctx, session, input)
    if (!result.ok) {
      control.cancel()
      return false
    }

    if (result.session !== session) {
      session = result.session
      writeRouteDragPreview(ctx, session, result.patch)
    }

    return true
  }

  return {
    mode: 'edge-route',
    pointerId: session.pointerId,
    autoPan: {
      frame: (pointer) => {
        step(pointer)
      }
    },
    move: (input) => {
      if (!step({
        clientX: input.client.x,
        clientY: input.client.y
      })) {
        return
      }

      control.pan({
        clientX: input.client.x,
        clientY: input.client.y
      })
    },
    up: (input) => {
      if (!step({
        clientX: input.client.x,
        clientY: input.client.y
      })) {
        return
      }

      commitRouteDrag(ctx, session)
      control.finish()
    },
    cleanup: () => {
      clearEdgePatches(ctx)
    }
  }
}

const resolveRouteState = (
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

const startEdgeBodyInteraction = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  control: InteractionControl
): InteractionStartResult => {
  if (
    ctx.read.tool.get().type !== 'select'
    || input.pick.kind !== 'edge'
    || input.pick.part !== 'body'
  ) {
    return null
  }

  const item = ctx.read.edge.item.get(input.pick.id)
  const capability = item
    ? ctx.read.edge.capability(item.edge)
    : undefined
  if (!capability) {
    return null
  }

  if (input.modifiers.shift || input.detail >= 2) {
    if (!capability.editRoute) {
      return null
    }

    ctx.commands.selection.replace({
      edgeIds: [input.pick.id]
    })
    ctx.commands.edge.route.insert(input.pick.id, input.world)
    clearEdgeOverlay(ctx)
    return HANDLED
  }

  if (!capability.move) {
    return null
  }

  const session: BodyMoveSession = {
    edgeId: input.pick.id,
    pointerId: input.pointerId,
    start: input.world,
    delta: { x: 0, y: 0 }
  }

  ctx.commands.selection.replace({
    edgeIds: [session.edgeId]
  })

  return {
    kind: 'session',
    session: createBodyMoveSession(ctx, session, control)
  }
}

const startEdgePathInteraction = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  control: InteractionControl
): InteractionStartResult => {
  if (
    ctx.read.tool.get().type !== 'select'
    || input.pick.kind !== 'edge'
    || input.pick.part !== 'path'
  ) {
    return null
  }

  const routeState = resolveRouteState(ctx, input)
  if (!routeState) {
    return null
  }

  if (routeState.kind === 'remove') {
    ctx.commands.edge.route.remove(routeState.edgeId, routeState.index)
    clearEdgePatches(ctx)
    return HANDLED
  }

  if (routeState.kind === 'insert') {
    const result = ctx.commands.edge.route.insert(routeState.edgeId, routeState.worldPoint)
    if (!result.ok) {
      clearEdgePatches(ctx)
      return HANDLED
    }

    const origin = readRouteOrigin(ctx, routeState.edgeId, result.data.index) ?? routeState.worldPoint
    return {
      kind: 'session',
      session: createRouteDragSession(ctx, {
        kind: 'drag',
        edgeId: routeState.edgeId,
        index: result.data.index,
        pointerId: input.pointerId,
        start: input.world,
        origin,
        point: origin
      }, control)
    }
  }

  return {
    kind: 'session',
    session: createRouteDragSession(ctx, routeState, control)
  }
}

export const startEdgeRouteInteraction = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  control: InteractionControl
): InteractionStartResult => (
  startEdgeBodyInteraction(ctx, input, control)
  ?? startEdgePathInteraction(ctx, input, control)
)

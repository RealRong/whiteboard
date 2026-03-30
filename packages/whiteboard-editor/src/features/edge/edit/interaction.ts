import { moveEdge } from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type {
  EdgeId,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { PointerDown } from '../../../runtime/input/pointer'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'
import type { EdgeConnectInteraction } from '../connect/interaction'
import {
  clearEdgeProjectionHint,
  clearEdgeProjectionPatch,
} from '../projection'

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

export type EdgeEditInteraction = {
  body: InteractionRegistration<BodyState>
  route: InteractionRegistration<RouteState>
  clear: () => void
}

type EdgeEditInteractionDeps = Pick<
  EditorFeatureContext,
  'read' | 'commands' | 'viewport' | 'projection' | 'spatial'
>

const isEdgeRoutePick = (
  pick: PointerDown['pick']
): pick is EdgeRoutePick => (
  pick.kind === 'edge'
  && pick.part === 'path'
)

export const createEdgeEditInteraction = (
  ctx: EdgeEditInteractionDeps,
  connect: Pick<EdgeConnectInteraction, 'clear'>
): EdgeEditInteraction => {
  const clear = () => {
    clearEdgeProjectionPatch(ctx.projection.edge)
    clearEdgeProjectionHint(ctx.projection.edge)
    connect.clear()
  }

  const readMovePatch = (
    edgeId: EdgeId,
    delta: Point
  ): EdgePatch | undefined => {
    const view = ctx.read.edge.view.get(edgeId)
    if (!view?.can.move) {
      return undefined
    }

    return moveEdge(view.edge, delta)
  }

  const writePreviewPatch = (
    edgeId: EdgeId,
    patch: EdgePatch | undefined
  ) => {
    if (!patch) {
      clearEdgeProjectionPatch(ctx.projection.edge)
      return
    }

    ctx.projection.edge.writePatch(edgeId, patch)
  }

  const readRouteView = (
    edgeId: EdgeId
  ) => ctx.read.edge.view.get(edgeId)

  const readRoutePoints = (
    edgeId: EdgeId
  ) => {
    const view = readRouteView(edgeId)
    if (!view?.can.editRoute) {
      return []
    }

    return view.handles.flatMap((handle) => (
      handle.kind === 'anchor'
        ? [handle.point]
        : []
    ))
  }

  const readRouteOrigin = (
    edgeId: EdgeId,
    index: number
  ) => readRoutePoints(edgeId)[index]

  const readRoutePoint = (
    pick: EdgeRoutePick
  ): RoutePoint | undefined => {
    const view = readRouteView(pick.id)
    if (!view?.can.editRoute) {
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
    edgeId: EdgeId,
    points: readonly Point[],
    activeRouteIndex?: number
  ) => {
    ctx.projection.edge.writeRoute(
      edgeId,
      points,
      activeRouteIndex
    )
  }

  const updateBodyMove = (
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
    const patch = readMovePatch(state.edgeId, delta)
    if (!patch) {
      return
    }

    writePreviewPatch(state.edgeId, patch)
  }

  const commitBodyMove = (
    state: BodyMoveState
  ) => {
    if (!isPointEqual(state.delta, { x: 0, y: 0 })) {
      ctx.commands.edge.move(state.edgeId, state.delta)
      ctx.commands.selection.clear()
    }
  }

  const updateRouteDrag = (
    state: RouteDragState,
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const points = readRoutePoints(state.edgeId)
    if (!points.length || state.index < 0 || state.index >= points.length) {
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
    writeRoutePreview(
      state.edgeId,
      points.map((entryPoint, pointIndex) => (
        pointIndex === state.index ? point : entryPoint
      )),
      state.index
    )
    return true
  }

  const commitRouteDrag = (
    state: RouteDragState
  ) => {
    if (
      readRouteView(state.edgeId)?.can.editRoute
      && !isPointEqual(state.point, state.origin)
    ) {
      ctx.commands.edge.route.move(state.edgeId, state.index, state.point)
    }
  }

  const body: InteractionRegistration<BodyState> = {
    key: 'edge.body',
    priority: 370,
    mode: 'edge-drag',
    pan: (state) => (
      state.kind === 'move'
        ? {
            frame: (pointer) => {
              updateBodyMove(state, pointer)
            }
          }
        : false
    ),
    can: (input) => {
      if (
        input.tool.type !== 'select'
        || input.pick.kind !== 'edge'
        || input.pick.part !== 'body'
      ) {
        return null
      }

      const view = ctx.read.edge.view.get(input.pick.id)
      if (!view) {
        return null
      }

      if (input.event.shiftKey || input.event.detail >= 2) {
        return view.can.editRoute
          ? {
              kind: 'insert',
              edgeId: input.pick.id
            }
          : null
      }

      if (!view.can.move) {
        return null
      }

      return {
        kind: 'move',
        edgeId: input.pick.id,
        pointerId: input.event.pointerId,
        start: input.point.world,
        delta: { x: 0, y: 0 }
      }
    },
    start: ({ input, state, session }) => {
      ctx.commands.selection.replace({
        edgeIds: [state.edgeId]
      })

      if (state.kind === 'insert') {
        ctx.commands.edge.route.insert(state.edgeId, input.point.world)
        input.event.preventDefault()
        input.event.stopPropagation()
        session.finish()
        return
      }

      input.event.preventDefault()
      input.event.stopPropagation()
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      if (state.kind !== 'move') {
        return
      }

      updateBodyMove(state, input.raw)
      session.pan(input.raw)
    },
    up: ({ state, session }) => {
      if (state.kind === 'move') {
        commitBodyMove(state)
      }

      session.finish()
    },
    cleanup: () => {
      clearEdgeProjectionPatch(ctx.projection.edge)
    }
  }

  const route: InteractionRegistration<RouteState> = {
    key: 'edge.route',
    priority: 380,
    mode: 'edge-route',
    pan: (state) => (
      state.kind === 'drag'
        ? {
            frame: (pointer) => {
              updateRouteDrag(state, pointer)
            }
          }
        : false
    ),
    can: (input) => {
      if (
        input.tool.type !== 'select'
        || !isEdgeRoutePick(input.pick)
      ) {
        return null
      }

      const routePoint = readRoutePoint(input.pick)
      if (!routePoint) {
        return null
      }

      if (routePoint.kind === 'insert') {
        return {
          kind: 'insert',
          edgeId: routePoint.edgeId,
          worldPoint: input.point.world
        }
      }

      if (input.event.detail >= 2) {
        return {
          kind: 'remove',
          edgeId: routePoint.edgeId,
          index: routePoint.index
        }
      }

      return {
        kind: 'drag',
        edgeId: routePoint.edgeId,
        index: routePoint.index,
        pointerId: input.event.pointerId,
        start: input.point.world,
        origin: routePoint.point,
        point: routePoint.point
      }
    },
    start: ({ input, state, session }) => {
      if (state.kind === 'remove') {
        ctx.commands.edge.route.remove(state.edgeId, state.index)
        input.event.preventDefault()
        input.event.stopPropagation()
        session.finish()
        return
      }

      if (state.kind === 'insert') {
        const result = ctx.commands.edge.route.insert(state.edgeId, state.worldPoint)
        if (!result.ok) {
          session.finish()
          return
        }

        const origin = readRouteOrigin(state.edgeId, result.data.index) ?? state.worldPoint
        Object.assign(state, {
          kind: 'drag',
          index: result.data.index,
          pointerId: input.event.pointerId,
          start: input.point.world,
          origin,
          point: origin
        })
      }

      if (state.kind === 'drag') {
        writeRoutePreview(state.edgeId, readRoutePoints(state.edgeId), state.index)
      }

      input.event.preventDefault()
      input.event.stopPropagation()
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      if (state.kind !== 'drag') {
        return
      }

      if (!updateRouteDrag(state, input.raw)) {
        session.cancel()
        return
      }

      session.pan(input.raw)
    },
    up: ({ state, session }) => {
      if (state.kind === 'drag') {
        commitRouteDrag(state)
      }

      session.finish()
    },
    cleanup: () => {
      clearEdgeProjectionPatch(ctx.projection.edge)
    }
  }

  return {
    body,
    route,
    clear
  }
}

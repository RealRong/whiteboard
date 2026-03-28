import { moveEdge } from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type {
  EdgeId,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { InteractionStart } from '../../runtime/input/pointer'
import type { EditorRuntime } from '../../runtime/editor/types'
import { createRafTask } from '../../runtime/utils/rafTask'
import type { EdgeConnectSession } from './connectSession'
import {
  isEdgeInteractionStart
} from './interactionStart'

type EdgeInputRuntimeDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: Pick<EditorRuntime['internals'], 'edge' | 'snap'>
}

type ActiveDrag = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
}

type ActiveRoute = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

type PointerSourceEvent = Pick<
  PointerEvent,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'detail'
  | 'pointerId'
  | 'preventDefault'
  | 'shiftKey'
  | 'stopPropagation'
  | 'target'
>

type EdgeRoutePick = Extract<InteractionStart['pick'], {
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

type PatchSessionMode = 'edge-drag' | 'edge-route'

type PatchSessionUpdateResult = 'cancel' | 'keep'

type EdgePatchSession<Active> = {
  cancel: () => void
  isActive: () => boolean
  start: (input: {
    event: Pick<PointerSourceEvent, 'pointerId'>
    capture: Element | null
    active: Active
  }) => boolean
}

export type EdgeInputRuntime = {
  down: (input: InteractionStart) => boolean
  pointerMove: (event: PointerEvent) => void
  pointerLeave: () => void
  cancel: () => void
}

const readCaptureTarget = (
  event: Pick<PointerEvent, 'currentTarget' | 'target'>
): Element | null => (
  event.currentTarget instanceof Element
    ? event.currentTarget
    : event.target instanceof Element
      ? event.target
      : null
)

const isEdgeRoutePick = (
  pick: InteractionStart['pick']
): pick is EdgeRoutePick => (
  pick.kind === 'edge'
  && pick.part === 'path'
)

const createEdgePatchSession = <Active,>(
  editor: EdgeInputRuntimeDeps,
  mode: PatchSessionMode,
  update: (
    active: Active,
    input: {
      clientX: number
      clientY: number
    }
  ) => PatchSessionUpdateResult | void,
  commit: (active: Active) => void
): EdgePatchSession<Active> => {
  let active: Active | null = null
  let session: ReturnType<typeof editor.interaction.start> = null

  const clear = () => {
    active = null
    session = null
    editor.internals.edge.preview.patch.clear()
  }

  const cancel = () => {
    if (session) {
      session.cancel()
      return
    }

    clear()
  }

  const runUpdate = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    if (!active) {
      return false
    }

    if (update(active, input) === 'cancel') {
      cancel()
      return false
    }

    return true
  }

  return {
    cancel,
    isActive: () => active !== null,
    start: (input) => {
      const nextSession = editor.interaction.start({
        mode,
        pointerId: input.event.pointerId,
        capture: input.capture,
        pan: {
          frame: (pointer) => {
            runUpdate(pointer)
          }
        },
        cleanup: clear,
        move: (moveEvent, interactionSession) => {
          if (!runUpdate(moveEvent)) {
            return
          }

          interactionSession.pan(moveEvent)
        },
        up: (_upEvent, interactionSession) => {
          if (!active) {
            return
          }

          commit(active)
          interactionSession.finish()
        }
      })
      if (!nextSession) {
        return false
      }

      active = input.active
      session = nextSession
      return true
    }
  }
}

export const createEdgeInputRuntime = (
  editor: EdgeInputRuntimeDeps,
  connect: Pick<EdgeConnectSession, 'cancel' | 'reconnect'>
): EdgeInputRuntime => {
  let hoverPoint: Point | null = null

  const clearHint = () => {
    editor.internals.edge.preview.hint.clear()
  }

  const hoverTask = createRafTask(() => {
    if (!editor.read.tool.is('edge')) {
      clearHint()
      return
    }

    const mode = editor.interaction.mode.get()
    if (mode === 'edge-connect') {
      return
    }
    if (mode !== 'idle') {
      clearHint()
      return
    }

    if (!hoverPoint) {
      clearHint()
      return
    }

    const target = editor.internals.snap.edge.connect(hoverPoint)
    editor.internals.edge.preview.hint.set(
      target
        ? { snap: target.pointWorld }
        : undefined
    )
  })

  const readMovePatch = (
    edgeId: EdgeId,
    delta: Point
  ): EdgePatch | undefined => {
    const view = editor.read.edge.view.get(edgeId)
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
      editor.internals.edge.preview.patch.clear()
      return
    }

    editor.internals.edge.preview.writePatch(edgeId, patch)
  }

  const readRouteView = (
    edgeId: EdgeId
  ) => editor.read.edge.view.get(edgeId)

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
    editor.internals.edge.preview.writeRoute(
      edgeId,
      points,
      activeRouteIndex
    )
  }

  const dragSession = createEdgePatchSession<ActiveDrag>(
    editor,
    'edge-drag',
    (active, input) => {
      const { world } = editor.viewport.pointer(input)
      const delta = {
        x: world.x - active.start.x,
        y: world.y - active.start.y
      }
      if (isPointEqual(delta, active.delta)) {
        return
      }

      active.delta = delta
      const patch = readMovePatch(active.edgeId, delta)
      if (!patch) {
        return 'cancel'
      }

      writePreviewPatch(active.edgeId, patch)
    },
    (active) => {
      if (!isPointEqual(active.delta, { x: 0, y: 0 })) {
        editor.commands.edge.move(active.edgeId, active.delta)
        editor.commands.selection.clear()
      }
    }
  )

  const routeSession = createEdgePatchSession<ActiveRoute>(
    editor,
    'edge-route',
    (active, input) => {
      const points = readRoutePoints(active.edgeId)
      if (!points.length || active.index < 0 || active.index >= points.length) {
        return 'cancel'
      }

      const { world } = editor.viewport.pointer(input)
      const point = {
        x: active.origin.x + (world.x - active.start.x),
        y: active.origin.y + (world.y - active.start.y)
      }
      if (isPointEqual(point, active.point)) {
        return
      }

      active.point = point
      writeRoutePreview(
        active.edgeId,
        points.map((entryPoint, pointIndex) => (
          pointIndex === active.index ? point : entryPoint
        )),
        active.index
      )
    },
    (active) => {
      if (
        readRouteView(active.edgeId)?.can.editRoute
        && !isPointEqual(active.point, active.origin)
      ) {
        editor.commands.edge.route.move(active.edgeId, active.index, active.point)
      }
    }
  )

  const startEdgeDrag = (
    event: PointerSourceEvent,
    edgeId: EdgeId,
    capture: Element
  ) => {
    const view = editor.read.edge.view.get(edgeId)
    if (!view?.can.move) {
      return false
    }

    return dragSession.start({
      event,
      capture,
      active: {
        edgeId,
        pointerId: event.pointerId,
        start: editor.viewport.pointer(event).world,
        delta: { x: 0, y: 0 }
      }
    })
  }

  const startRouteDrag = (
    event: PointerSourceEvent,
    edgeId: EdgeId,
    index: number,
    origin: Point,
    capture?: Element | null
  ) => {
    const points = readRoutePoints(edgeId)
    const started = routeSession.start({
      event,
      capture: capture ?? readCaptureTarget(event),
      active: {
        edgeId,
        index,
        pointerId: event.pointerId,
        start: editor.viewport.pointer(event).world,
        origin,
        point: origin
      }
    })
    if (!started) {
      return false
    }

    writeRoutePreview(edgeId, points, index)
    return true
  }

  const startEdgeBodyDown = (
    input: InteractionStart
  ) => {
    const { event } = input
    if (input.pick.kind !== 'edge' || input.pick.part !== 'body') {
      return false
    }

    const edgeId = input.pick.id
    const view = editor.read.edge.view.get(edgeId)
    if (!view) {
      return false
    }

    if (event.shiftKey || event.detail >= 2) {
      if (!view.can.editRoute) {
        return false
      }

      const point = editor.viewport.pointer(event).world
      editor.commands.edge.route.insert(edgeId, point)
      editor.commands.selection.replace({
        edgeIds: [edgeId]
      })
      event.preventDefault()
      event.stopPropagation()
      return true
    }

    editor.commands.selection.replace({
      edgeIds: [edgeId]
    })
    const started = startEdgeDrag(event, edgeId, input.capture)
    if (!started) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    return true
  }

  const startEdgeRouteDown = (
    input: InteractionStart
  ) => {
    const { event } = input
    if (input.pick.kind !== 'edge' || !isEdgeRoutePick(input.pick)) {
      return false
    }

    const routePoint = readRoutePoint(input.pick)
    if (!routePoint) {
      return false
    }

    if (routePoint.kind === 'insert') {
      const worldPoint = editor.viewport.pointer(event).world
      const result = editor.commands.edge.route.insert(routePoint.edgeId, worldPoint)
      if (!result.ok) {
        return false
      }

      const origin = readRouteOrigin(routePoint.edgeId, result.data.index) ?? worldPoint
      if (!startRouteDrag(event, routePoint.edgeId, result.data.index, origin, input.capture)) {
        return false
      }

      event.preventDefault()
      event.stopPropagation()
      return true
    }

    const origin = readRouteOrigin(routePoint.edgeId, routePoint.index)
    if (!origin) {
      return false
    }

    if (event.detail >= 2) {
      editor.commands.edge.route.remove(routePoint.edgeId, routePoint.index)
      event.preventDefault()
      event.stopPropagation()
      return true
    }

    if (!startRouteDrag(event, routePoint.edgeId, routePoint.index, origin, input.capture)) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    down: (input) => {
      if (
        dragSession.isActive()
        || routeSession.isActive()
      ) {
        return false
      }

      if (!isEdgeInteractionStart(input)) {
        return false
      }

      hoverTask.cancel()
      hoverPoint = null
      clearHint()

      return (
        startEdgeBodyDown(input)
        || connect.reconnect(input)
        || startEdgeRouteDown(input)
      )
    },
    pointerMove: (event) => {
      hoverPoint = editor.viewport.pointer(event).world
      hoverTask.schedule()
    },
    pointerLeave: () => {
      hoverTask.cancel()
      hoverPoint = null
      if (editor.interaction.mode.get() !== 'edge-connect') {
        clearHint()
      }
    },
    cancel: () => {
      hoverTask.cancel()
      hoverPoint = null
      dragSession.cancel()
      routeSession.cancel()
      connect.cancel()
      clearHint()
    }
  }
}

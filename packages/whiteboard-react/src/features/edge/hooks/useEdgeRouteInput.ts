import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import type { EdgeDown } from '../../../runtime/input/pointer'
import type { SelectedEdgeRoutePointView } from './useEdgeView'
import {
  type PointerSourceEvent,
  useEdgePatchSession
} from './useEdgePatchSession'

type ActiveRoute = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

type EdgeRoutePick = EdgeDown['pick'] & {
  part: 'path'
}

const isEdgeRoutePick = (
  pick: EdgeDown['pick']
): pick is EdgeRoutePick => pick.part === 'path'

export const useEdgeRouteInput = () => {
  const instance = useInternalInstance()

  const readRouteView = useCallback((edgeId: EdgeId) => (
    instance.read.edge.view.get(edgeId)
  ), [instance])

  const readRoutePoints = useCallback((edgeId: EdgeId) => {
    const view = readRouteView(edgeId)
    if (!view?.can.editRoute) {
      return []
    }

    return view.handles.flatMap((handle) => (
      handle.kind === 'anchor'
        ? [handle.point]
        : []
    ))
  }, [readRouteView])

  const readRouteOrigin = useCallback((
    edgeId: EdgeId,
    index: number
  ) => readRoutePoints(edgeId)[index], [readRoutePoints])

  const readRoutePoint = useCallback((
    pick: EdgeRoutePick
  ): SelectedEdgeRoutePointView | undefined => {
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
        key: `${pick.id}:anchor:${handle.index}`,
        kind: 'anchor',
        edgeId: pick.id,
        index: handle.index,
        point: handle.point,
        active: false
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
      key: `${pick.id}:insert:${handle.insertIndex}`,
      kind: 'insert',
      edgeId: pick.id,
      insertIndex: handle.insertIndex,
      point: handle.point,
      active: false
    }
  }, [readRouteView])

  const writePreview = useCallback((
    edgeId: EdgeId,
    points: readonly Point[],
    activeRouteIndex?: number
  ) => {
    instance.host.edge.preview.writeRoute(
      edgeId,
      points,
      activeRouteIndex
    )
  }, [instance])

  const session = useEdgePatchSession<ActiveRoute>({
    mode: 'edge-route',
    update: (active, input) => {
      const points = readRoutePoints(active.edgeId)
      if (!points.length || active.index < 0 || active.index >= points.length) {
        return 'cancel'
      }

      const { world } = instance.viewport.pointer(input)
      const point = {
        x: active.origin.x + (world.x - active.start.x),
        y: active.origin.y + (world.y - active.start.y)
      }
      if (isPointEqual(point, active.point)) {
        return
      }

      active.point = point
      writePreview(
        active.edgeId,
        points.map((entryPoint, pointIndex) => (
          pointIndex === active.index ? point : entryPoint
        )),
        active.index
      )
    },
    commit: (active) => {
      if (
        readRouteView(active.edgeId)?.can.editRoute
        && !isPointEqual(active.point, active.origin)
      ) {
        instance.commands.edge.route.move(active.edgeId, active.index, active.point)
      }
    }
  })

  const startRouteDrag = useCallback((
    event: PointerSourceEvent,
    edgeId: EdgeId,
    index: number,
    origin: Point,
    capture?: Element | null
  ) => {
    const points = readRoutePoints(edgeId)
    const started = session.start({
      event,
      capture: capture ?? (event.target instanceof Element ? event.target : null),
      active: {
        edgeId,
        index,
        pointerId: event.pointerId,
        start: instance.viewport.pointer(event).world,
        origin,
        point: origin
      }
    })
    if (!started) {
      return false
    }

    writePreview(edgeId, points, index)
    return true
  }, [instance, readRoutePoints, session, writePreview])

  return {
    down: (
      input: EdgeDown
    ) => {
      const { event } = input

      if (session.activeRef.current) {
        return false
      }

      if (input.pick.kind !== 'edge' || !isEdgeRoutePick(input.pick)) {
        return false
      }

      const routePoint = readRoutePoint(input.pick)
      if (!routePoint) {
        return false
      }

      if (routePoint.kind === 'insert') {
        const worldPoint = instance.viewport.pointer(event).world
        const result = instance.commands.edge.route.insert(routePoint.edgeId, worldPoint)
        if (!result.ok) {
          return false
        }

        const origin = readRouteOrigin(
          routePoint.edgeId,
          result.data.index
        ) ?? worldPoint
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
        instance.commands.edge.route.remove(routePoint.edgeId, routePoint.index)
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
    },
    keyDown: (
      event: ReactKeyboardEvent<HTMLDivElement>,
      routePoint: Extract<SelectedEdgeRoutePointView, { kind: 'anchor' }>
    ) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      const points = readRoutePoints(routePoint.edgeId)
      if (routePoint.index < 0 || routePoint.index >= points.length) {
        return
      }

      instance.commands.edge.route.remove(routePoint.edgeId, routePoint.index)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

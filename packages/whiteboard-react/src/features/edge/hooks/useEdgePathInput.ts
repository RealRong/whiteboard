import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import { toPatchEntry } from '../preview'
import type { SelectedEdgePathPointView } from './useEdgeView'
import { toPathPatch } from './inputShared'
import { useEdgePatchSession } from './useEdgePatchSession'

type ActivePath = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export const useEdgePathInput = () => {
  const instance = useInternalInstance()

  const readPathEntry = useCallback((edgeId: EdgeId) => (
    instance.read.edge.item.get(edgeId)
  ), [instance])

  const writePreview = useCallback((
    edgeId: EdgeId,
    points: readonly Point[],
    activePathIndex?: number
  ) => {
    instance.internals.edge.preview.patch.write([
      toPatchEntry(edgeId, toPathPatch(points), activePathIndex)
    ])
  }, [instance])

  const session = useEdgePatchSession<ActivePath>({
    mode: 'edge-path',
    update: (active, input) => {
      const entry = readPathEntry(active.edgeId)
      if (!entry) {
        return 'cancel'
      }

      const points = entry.edge.path?.points ?? []
      if (active.index < 0 || active.index >= points.length) {
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
        readPathEntry(active.edgeId)
        && !isPointEqual(active.point, active.origin)
      ) {
        instance.commands.edge.path.move(active.edgeId, active.index, active.point)
      }
    }
  })

  const startPathDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number,
    origin: Point
  ) => {
    const points = readPathEntry(edgeId)?.edge.path?.points ?? []
    const started = session.start({
      event,
      capture: event.currentTarget,
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
  }, [instance, readPathEntry, session, writePreview])

  return {
    handlePathPointPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>,
      pathPoint: SelectedEdgePathPointView
    ) => {
      if (event.button !== 0) {
        return
      }

      if (session.activeRef.current) {
        return
      }

      if (pathPoint.kind === 'insert') {
        const worldPoint = instance.viewport.pointer(event).world
        const result = instance.commands.edge.path.insert(pathPoint.edgeId, worldPoint)
        if (!result.ok) {
          return
        }

        const origin =
          readPathEntry(pathPoint.edgeId)?.edge.path?.points?.[result.data.index]
          ?? worldPoint
        if (!startPathDrag(event, pathPoint.edgeId, result.data.index, origin)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const entry = readPathEntry(pathPoint.edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.path?.points ?? []
      const origin = points[pathPoint.index]
      if (!origin) {
        return
      }

      if (event.detail >= 2) {
        instance.commands.edge.path.remove(pathPoint.edgeId, pathPoint.index)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (!startPathDrag(event, pathPoint.edgeId, pathPoint.index, origin)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    },
    handlePathPointKeyDown: (
      event: ReactKeyboardEvent<HTMLDivElement>,
      pathPoint: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
    ) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      const entry = readPathEntry(pathPoint.edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.path?.points ?? []
      if (pathPoint.index < 0 || pathPoint.index >= points.length) {
        return
      }

      instance.commands.edge.path.remove(pathPoint.edgeId, pathPoint.index)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

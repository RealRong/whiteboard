import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import type { SelectedEdgePathPointView } from './useEdgeView'
import { toPathPatch, toSessionPatch } from './inputShared'

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
  const activeRef = useRef<ActivePath | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const readPathEntry = useCallback((edgeId: EdgeId) => (
    instance.read.edge.item.get(edgeId)
  ), [instance])

  const writeEdgePreview = useCallback((
    edgeId: EdgeId,
    points: readonly Point[],
    activePathIndex?: number
  ) => {
    instance.internals.edge.path.write({
      patches: [toSessionPatch(edgeId, toPathPatch(points), activePathIndex)]
    })
  }, [instance])

  const clearPath = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.edge.path.clear()
  }, [instance])

  const cancelPath = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clearPath()
  }, [clearPath])

  const updatePathPreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    const entry = readPathEntry(active.edgeId)
    if (!entry) {
      cancelPath()
      return
    }

    const points = entry.edge.path?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      cancelPath()
      return
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
    writeEdgePreview(
      active.edgeId,
      points.map((entryPoint, pointIndex) => (
        pointIndex === active.index ? point : entryPoint
      )),
      active.index
    )
  }, [cancelPath, instance, readPathEntry, writeEdgePreview])

  const startPathDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number,
    origin: Point
  ) => {
    const nextSession = instance.interaction.start({
      mode: 'edge-path',
      pointerId: event.pointerId,
      capture: event.currentTarget,
      pan: {
        frame: (pointer) => {
          updatePathPreview(pointer)
        }
      },
      cleanup: clearPath,
      move: (moveEvent, session) => {
        if (!activeRef.current) {
          return
        }

        session.pan(moveEvent)
        updatePathPreview(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        if (
          readPathEntry(active.edgeId)
          && !isPointEqual(active.point, active.origin)
        ) {
          instance.commands.edge.path.move(active.edgeId, active.index, active.point)
        }
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = {
      edgeId,
      index,
      pointerId: event.pointerId,
      start: instance.viewport.pointer(event).world,
      origin,
      point: origin
    }
    sessionRef.current = nextSession
    const points = readPathEntry(edgeId)?.edge.path?.points ?? []
    writeEdgePreview(edgeId, points, index)
    return true
  }, [clearPath, instance, readPathEntry, updatePathPreview, writeEdgePreview])

  useEffect(() => () => {
    cancelPath()
  }, [cancelPath])

  return {
    handlePathPointPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>,
      pathPoint: SelectedEdgePathPointView
    ) => {
      if (event.button !== 0) {
        return
      }

      if (activeRef.current) {
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

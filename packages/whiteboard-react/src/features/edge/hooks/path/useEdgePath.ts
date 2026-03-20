import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance } from '../../../../runtime/hooks'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'

type ActiveRouting = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export const useEdgeRouting = () => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveRouting | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const readRoutingEntry = useCallback((edgeId: EdgeId) => {
    const entry = instance.read.edge.item.get(edgeId)
    if (!entry || entry.edge.type === 'bezier' || entry.edge.type === 'curve') {
      return undefined
    }

    return entry
  }, [instance])

  const writePreview = useCallback((
    edgeId: EdgeId,
    index: number,
    points: readonly Point[]
  ) => {
    instance.internals.edge.routing.write({
      patches: [{
        id: edgeId,
        routingPoints: points,
        activeRoutingIndex: index
      }]
    })
  }, [instance])

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.edge.routing.clear()
  }, [instance])

  const cancel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clear()
  }, [clear])

  const updatePreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    const entry = readRoutingEntry(active.edgeId)
    if (!entry) {
      cancel()
      return
    }

    const points = entry.edge.routing?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      cancel()
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
    writePreview(
      active.edgeId,
      active.index,
      points.map((entryPoint, pointIndex) => (
        pointIndex === active.index ? point : entryPoint
      ))
    )
  }, [cancel, instance, readRoutingEntry, writePreview])

  useEffect(() => () => {
    cancel()
  }, [cancel])

  return {
    handleRoutingPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>,
      edgeId: EdgeId,
      index: number
    ) => {
      if (event.button !== 0) {
        return
      }

      if (activeRef.current) {
        return
      }

      const entry = readRoutingEntry(edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.routing?.points ?? []
      const origin = points[index]
      if (!origin) {
        return
      }

      if (event.detail >= 2) {
        instance.commands.edge.routing.remove(edgeId, index)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const nextSession = instance.interaction.start({
        mode: 'edge-routing',
        pointerId: event.pointerId,
        capture: event.currentTarget,
        pan: {
          frame: (pointer) => {
            updatePreview(pointer)
          }
        },
        cleanup: clear,
        move: (event, session) => {
          if (!activeRef.current) {
            return
          }

          session.pan(event)
          updatePreview(event)
        },
        up: (_event, session) => {
          const active = activeRef.current
          if (!active) {
            return
          }

          if (
            readRoutingEntry(active.edgeId)
            && !isPointEqual(active.point, active.origin)
          ) {
            instance.commands.edge.routing.move(active.edgeId, active.index, active.point)
          }
          session.finish()
        }
      })
      if (!nextSession) return

      activeRef.current = {
        edgeId,
        index,
        pointerId: event.pointerId,
        start: instance.viewport.pointer(event).world,
        origin,
        point: origin
      }
      sessionRef.current = nextSession
      writePreview(edgeId, index, points)

      event.preventDefault()
      event.stopPropagation()
    },
    handleRoutingKeyDown: (
      event: ReactKeyboardEvent<HTMLDivElement>,
      edgeId: EdgeId,
      index: number
    ) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      const entry = readRoutingEntry(edgeId)
      if (!entry) {
        return
      }

      const points = entry.edge.routing?.points ?? []
      if (index < 0 || index >= points.length) {
        return
      }

      instance.commands.edge.routing.remove(edgeId, index)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

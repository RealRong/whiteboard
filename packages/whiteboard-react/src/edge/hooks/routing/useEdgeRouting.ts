import { useCallback, useRef, useState } from 'react'
import { isPointEqual } from '@whiteboard/core/geometry'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../../common/interaction/useWindowPointerSession'

type ActiveRouting = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
  lockToken: InteractionLockToken
}

const readPointerWorld = (
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

const readRoutingEntry = (
  instance: ReturnType<typeof useInstance>,
  edgeId: EdgeId
) => {
  const entry = instance.read.edge.get(edgeId)
  if (!entry || entry.edge.type === 'bezier' || entry.edge.type === 'curve') return undefined
  return entry
}

export const useEdgeRouting = () => {
  const instance = useInstance()
  const { edge } = instance.draft
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveRouting | null>(null)

  const writePreview = useCallback((
    edgeId: EdgeId,
    index: number,
    points: readonly Point[]
  ) => {
    edge.write({
      patches: [{
        id: edgeId,
        routingPoints: points,
        activeRoutingIndex: index
      }]
    })
  }, [edge])

  const cancelRoutingSession = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.pointerId !== pointerId) return

    activeRef.current = null
    setActivePointerId(null)
    edge.clear()
    instance.commands.session.end()
    if (!active) return
    interactionLock.release(instance, active.lockToken)
  }, [edge, instance])

  const handleRoutingPointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number
  ) => {
    if (event.button !== 0) return
    if (activeRef.current) return

    const entry = readRoutingEntry(instance, edgeId)
    if (!entry) return

    const points = entry.edge.routing?.points ?? []
    const origin = points[index]
    if (!origin) return

    if (event.detail >= 2) {
      instance.commands.edge.routing.remove(edgeId, index)
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const lockToken = interactionLock.tryAcquire(instance, 'edgeRouting', event.pointerId)
    if (!lockToken) return

    const start = readPointerWorld(instance, event)

    activeRef.current = {
      edgeId,
      index,
      pointerId: event.pointerId,
      start,
      origin,
      point: origin,
      lockToken
    }
    setActivePointerId(event.pointerId)
    instance.commands.session.beginEdgeRouting()
    writePreview(edgeId, index, points)

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }

    event.preventDefault()
    event.stopPropagation()
  }, [instance, writePreview])

  const handleRoutingKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number
  ) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return

    const entry = readRoutingEntry(instance, edgeId)
    if (!entry) return

    const points = entry.edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return

    instance.commands.edge.routing.remove(edgeId, index)
    event.preventDefault()
    event.stopPropagation()
  }, [instance])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      const entry = readRoutingEntry(instance, active.edgeId)
      if (!entry) {
        cancelRoutingSession(active.pointerId)
        return
      }

      const points = entry.edge.routing?.points ?? []
      if (active.index < 0 || active.index >= points.length) {
        cancelRoutingSession(active.pointerId)
        return
      }

      const world = readPointerWorld(instance, event)
      const point = {
        x: active.origin.x + (world.x - active.start.x),
        y: active.origin.y + (world.y - active.start.y)
      }
      if (isPointEqual(point, active.point)) return

      active.point = point
      const previewPoints = points.map((entryPoint, index) => (
        index === active.index ? point : entryPoint
      ))
      writePreview(active.edgeId, active.index, previewPoints)
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      if (
        readRoutingEntry(instance, active.edgeId)
        && !isPointEqual(active.point, active.origin)
      ) {
        instance.commands.edge.routing.move(active.edgeId, active.index, active.point)
      }
      cancelRoutingSession(active.pointerId)
    },

    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      cancelRoutingSession(active.pointerId)
    },

    onBlur: () => {
      cancelRoutingSession()
    },

    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancelRoutingSession()
    }
  })

  return {
    cancelRoutingSession,
    handleRoutingPointerDown,
    handleRoutingKeyDown
  }
}

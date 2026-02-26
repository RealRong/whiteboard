import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { Edge, EdgeId, Point } from '@whiteboard/core/types'
import { useInstance } from '../../common/hooks'
import { sessionLockStore, type SessionLockToken } from '../../common/interaction/sessionLockStore'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import { viewportGestureStore } from '../../common/interaction/viewportGestureStore'
import {
  edgeRoutingPreviewStore,
  type RoutingPreviewDraft
} from '../interaction/routingPreviewStore'

type EdgeEntry = {
  edge: Edge
}

const toPointerWorld = (
  clientX: number,
  clientY: number,
  clientToScreen: (clientX: number, clientY: number) => Point,
  screenToWorld: (screen: Point) => Point
) => {
  const screen = clientToScreen(clientX, clientY)
  return screenToWorld(screen)
}

const resolveEdgeEntry = (
  edgeId: EdgeId,
  readById: (id: EdgeId) => EdgeEntry | undefined
): EdgeEntry | undefined => readById(edgeId)

export const useEdgeRoutingInteraction = () => {
  const instance = useInstance()
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<RoutingPreviewDraft | null>(null)
  const lockTokenRef = useRef<SessionLockToken | null>(null)

  const readEdgeById = useCallback(
    (edgeId: EdgeId) =>
      instance.view.getState().edges.byId.get(edgeId) as EdgeEntry | undefined,
    [instance.view]
  )

  const clearActive = useCallback((pointerId?: number) => {
    const active = activeRef.current
    const lockToken = lockTokenRef.current
    if (!active) {
      if (
        lockToken
        && (
          pointerId === undefined
          || lockToken.pointerId === undefined
          || lockToken.pointerId === pointerId
        )
      ) {
        sessionLockStore.release(lockToken)
        lockTokenRef.current = null
      }
      return
    }
    if (pointerId !== undefined && active.pointerId !== pointerId) return
    activeRef.current = null
    setActivePointerId(null)
    edgeRoutingPreviewStore.clearDraft(pointerId)
    if (
      lockToken
      && (
        lockToken.pointerId === undefined
        || lockToken.pointerId === active.pointerId
      )
    ) {
      sessionLockStore.release(lockToken)
      lockTokenRef.current = null
    }
  }, [])

  const handleRoutingPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      edgeId: EdgeId,
      index: number
    ) => {
      if (event.button !== 0) return
      if (activeRef.current) return
      if (viewportGestureStore.isSpacePressed()) return

      const entry = resolveEdgeEntry(edgeId, readEdgeById)
      if (!entry) return
      if (entry.edge.type === 'bezier' || entry.edge.type === 'curve') return
      const points = entry.edge.routing?.points ?? []
      if (index < 0 || index >= points.length) return

      if (event.detail >= 2) {
        instance.commands.edge.removeRoutingPoint(entry.edge, index)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const start = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      const origin = points[index]
      if (!origin) return
      const lockToken = sessionLockStore.tryAcquire('edgeRouting', event.pointerId)
      if (!lockToken) return
      const draft: RoutingPreviewDraft = {
        edgeId,
        index,
        pointerId: event.pointerId,
        start,
        origin,
        point: origin
      }
      activeRef.current = draft
      lockTokenRef.current = lockToken
      setActivePointerId(event.pointerId)
      edgeRoutingPreviewStore.setDraft(draft)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle lifecycle.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [
      instance.commands.edge,
      instance.query.viewport.clientToScreen,
      instance.query.viewport.screenToWorld,
      readEdgeById
    ]
  )

  const handleRoutingKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLDivElement>,
      edgeId: EdgeId,
      index: number
    ) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const entry = resolveEdgeEntry(edgeId, readEdgeById)
      if (!entry) return
      if (entry.edge.type === 'bezier' || entry.edge.type === 'curve') return
      const points = entry.edge.routing?.points ?? []
      if (index < 0 || index >= points.length) return
      instance.commands.edge.removeRoutingPoint(entry.edge, index)
      event.preventDefault()
      event.stopPropagation()
    },
    [instance.commands.edge, readEdgeById]
  )

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      const entry = resolveEdgeEntry(active.edgeId, readEdgeById)
      if (!entry || entry.edge.type === 'bezier' || entry.edge.type === 'curve') {
        clearActive(active.pointerId)
        return
      }
      const points = entry.edge.routing?.points ?? []
      if (active.index < 0 || active.index >= points.length) {
        clearActive(active.pointerId)
        return
      }

      const world = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      const point = {
        x: active.origin.x + (world.x - active.start.x),
        y: active.origin.y + (world.y - active.start.y)
      }
      const next: RoutingPreviewDraft = {
        ...active,
        point
      }
      activeRef.current = next
      edgeRoutingPreviewStore.setDraft(next)
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      const entry = resolveEdgeEntry(active.edgeId, readEdgeById)
      if (entry && entry.edge.type !== 'bezier' && entry.edge.type !== 'curve') {
        instance.commands.edge.moveRoutingPoint(
          entry.edge,
          active.index,
          active.point
        )
      }
      clearActive(active.pointerId)
    },

    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)
    },

    onBlur: () => {
      clearActive()
    },

    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearActive()
    }
  })

  useEffect(
    () => () => {
      clearActive()
    },
    [clearActive]
  )

  return {
    handleRoutingPointerDown,
    handleRoutingKeyDown
  }
}

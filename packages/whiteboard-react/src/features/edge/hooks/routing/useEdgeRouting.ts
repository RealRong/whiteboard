import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { createValueStore } from '@whiteboard/core/runtime'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance as useInstance, useView } from '../../../../runtime/hooks'
import { interactionLock } from '../../../../runtime/interaction/interactionLock'
import { useWindowPointerSession } from '../../../../runtime/interaction/useWindowPointerSession'
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
  const instance = useInstance()
  const activeRef = useRef<ActiveRouting | null>(null)
  const tokenRef = useRef<ReturnType<typeof instance.interaction.tryStart> | null>(null)
  const lockTokenRef = useRef<ReturnType<typeof interactionLock.tryAcquire> | null>(null)
  const pointerRef = useRef(createValueStore<number | null>(null))

  const readRoutingEntry = useCallback((edgeId: EdgeId) => {
    const entry = instance.read.edge.byId.get(edgeId)
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
    instance.draft.edge.write({
      patches: [{
        id: edgeId,
        routingPoints: points,
        activeRoutingIndex: index
      }]
    })
  }, [instance])

  const cancel = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.pointerId !== pointerId) {
      return
    }

    const token = tokenRef.current
    const lockToken = lockTokenRef.current
    activeRef.current = null
    tokenRef.current = null
    lockTokenRef.current = null
    pointerRef.current.set(null)
    instance.draft.edge.clear()

    if (lockToken) {
      interactionLock.release(instance, lockToken)
    }

    if (token) {
      instance.interaction.finish(token)
    }
  }, [instance])

  const pointerId = useView(pointerRef.current)

  useWindowPointerSession({
    pointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      const entry = readRoutingEntry(active.edgeId)
      if (!entry) {
        cancel(active.pointerId)
        return
      }

      const points = entry.edge.routing?.points ?? []
      if (active.index < 0 || active.index >= points.length) {
        cancel(active.pointerId)
        return
      }

      const { world } = instance.viewport.pointer(event)
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
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      if (
        readRoutingEntry(active.edgeId)
        && !isPointEqual(active.point, active.origin)
      ) {
        instance.commands.edge.routing.move(active.edgeId, active.index, active.point)
      }
      cancel(active.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      cancel(active.pointerId)
    },
    onBlur: () => {
      cancel()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') {
        return
      }

      cancel()
    }
  })

  useEffect(() => () => {
    cancel()
  }, [cancel])

  return {
    handleEdgePathPointerDown: (event: ReactPointerEvent<SVGPathElement>) => {
      if (event.button !== 0) {
        return
      }

      const edgeId = event.currentTarget.closest('[data-edge-id]')?.getAttribute('data-edge-id') as EdgeId | null
      if (!edgeId) {
        return
      }

      const entry = instance.read.edge.byId.get(edgeId)
      if (!entry) {
        return
      }

      if (!instance.read.scope.hasEdge(entry.edge)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      if (event.shiftKey || event.detail >= 2) {
        const point = instance.viewport.pointer(event).world
        instance.commands.edge.routing.insertAtPoint(edgeId, point)
      }

      instance.commands.selection.selectEdge(edgeId)
      event.preventDefault()
      event.stopPropagation()
    },
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

      const lockToken = interactionLock.tryAcquire(instance, 'edgeRouting', event.pointerId)
      if (!lockToken) {
        return
      }

      const token = instance.interaction.tryStart('edge-routing', () => cancel(event.pointerId))
      if (!token) {
        interactionLock.release(instance, lockToken)
        return
      }

      activeRef.current = {
        edgeId,
        index,
        pointerId: event.pointerId,
        start: instance.viewport.pointer(event).world,
        origin,
        point: origin
      }
      tokenRef.current = token
      lockTokenRef.current = lockToken
      pointerRef.current.set(event.pointerId)
      writePreview(edgeId, index, points)

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

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

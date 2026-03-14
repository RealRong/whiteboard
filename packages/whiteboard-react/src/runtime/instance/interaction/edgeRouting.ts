import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { interactionLock, type InteractionLockToken } from '../../interaction/interactionLock'
import type { InternalWhiteboardInstance } from '../types'
import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  EdgeRoutingInteractionRuntime,
  InteractionSession
} from './types'

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
  instance: InternalWhiteboardInstance,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

const readRoutingEntry = (
  instance: InternalWhiteboardInstance,
  edgeId: EdgeId
) => {
  const entry = instance.read.edge.get(edgeId)
  if (!entry || entry.edge.type === 'bezier' || entry.edge.type === 'curve') return undefined
  return entry
}

export const createEdgeRoutingInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance,
  lifecycle: {
    begin: (kind: ActiveInteractionSessionKind) => void
    end: () => void
  }
): EdgeRoutingInteractionRuntime => {
  let active: ActiveRouting | null = null
  const pointer = createSignal<number | null>(null)

  const writePreview = (
    edgeId: EdgeId,
    index: number,
    points: readonly Point[]
  ) => {
    getInstance().draft.edge.write({
      patches: [{
        id: edgeId,
        routingPoints: points,
        activeRoutingIndex: index
      }]
    })
  }

  const cancel = (pointerId?: number) => {
    const instance = getInstance()
    if (pointerId !== undefined && active && active.pointerId !== pointerId) return

    const previous = active
    active = null
    pointer.set(null)
    instance.draft.edge.clear()
    lifecycle.end()
    if (!previous) return
    interactionLock.release(instance, previous.lockToken)
  }

  return {
    pointer,
    cancel,
    handleEdgePathPointerDown: (event: ReactPointerEvent<SVGPathElement>) => {
      const instance = getInstance()
      if (event.button !== 0) return

      const edgeId = event.currentTarget.closest('[data-edge-id]')?.getAttribute('data-edge-id') as EdgeId | null
      if (!edgeId) return

      const entry = instance.read.edge.get(edgeId)
      if (!entry) return

      if (!instance.read.container.hasEdge(entry.edge)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      if (event.shiftKey || event.detail >= 2) {
        const point = readPointerWorld(instance, event)
        instance.commands.edge.routing.insertAtPoint(edgeId, point)
      }

      instance.commands.selection.selectEdge(edgeId)
      event.preventDefault()
      event.stopPropagation()
    },
    handleRoutingPointerDown: (event, edgeId, index) => {
      const instance = getInstance()
      if (event.button !== 0) return
      if (active) return

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

      active = {
        edgeId,
        index,
        pointerId: event.pointerId,
        start,
        origin,
        point: origin,
        lockToken
      }
      pointer.set(event.pointerId)
      lifecycle.begin('edge-routing')
      writePreview(edgeId, index, points)

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

      event.preventDefault()
      event.stopPropagation()
    },
    handleRoutingKeyDown: (event, edgeId, index) => {
      const instance = getInstance()
      if (event.key !== 'Backspace' && event.key !== 'Delete') return

      const entry = readRoutingEntry(instance, edgeId)
      if (!entry) return

      const points = entry.edge.routing?.points ?? []
      if (index < 0 || index >= points.length) return

      instance.commands.edge.routing.remove(edgeId, index)
      event.preventDefault()
      event.stopPropagation()
    },
    onWindowPointerMove: (event) => {
      const instance = getInstance()
      if (!active || event.pointerId !== active.pointerId) return

      const entry = readRoutingEntry(instance, active.edgeId)
      if (!entry) {
        cancel(active.pointerId)
        return
      }

      const points = entry.edge.routing?.points ?? []
      if (active.index < 0 || active.index >= points.length) {
        cancel(active.pointerId)
        return
      }

      const world = readPointerWorld(instance, event)
      const point = {
        x: active.origin.x + (world.x - active.start.x),
        y: active.origin.y + (world.y - active.start.y)
      }
      if (isPointEqual(point, active.point)) return

      active.point = point
      const previewPoints = points.map((entryPoint, pointIndex) => (
        pointIndex === active?.index ? point : entryPoint
      ))
      writePreview(active.edgeId, active.index, previewPoints)
    },
    onWindowPointerUp: (event) => {
      const instance = getInstance()
      if (!active || event.pointerId !== active.pointerId) return

      if (
        readRoutingEntry(instance, active.edgeId)
        && !isPointEqual(active.point, active.origin)
      ) {
        instance.commands.edge.routing.move(active.edgeId, active.index, active.point)
      }
      cancel(active.pointerId)
    },
    onWindowPointerCancel: (event) => {
      if (!active || event.pointerId !== active.pointerId) return
      cancel(active.pointerId)
    },
    onWindowBlur: () => {
      cancel()
    },
    onWindowKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancel()
    }
  }
}

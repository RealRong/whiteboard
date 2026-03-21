import { moveEdge } from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  hasEdge,
  leave
} from '../../../runtime/container'
import { useInternalInstance } from '../../../runtime/hooks'
import type { PointerSourceEvent } from './inputShared'
import {
  canMoveEdge,
  readCaptureTarget,
  toSessionPatch
} from './inputShared'

type ActiveDrag = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
  edge: EdgeItem['edge']
}

export const useEdgeDragInput = () => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveDrag | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const writeEdgePreview = useCallback((
    edgeId: EdgeId,
    patch: ReturnType<typeof moveEdge>
  ) => {
    if (!patch) {
      instance.internals.edge.path.clear()
      return
    }

    instance.internals.edge.path.write({
      patches: [toSessionPatch(edgeId, patch)]
    })
  }, [instance])

  const clearDrag = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.edge.path.clear()
  }, [instance])

  const cancelDrag = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clearDrag()
  }, [clearDrag])

  const updateDragPreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    const { world } = instance.viewport.pointer(input)
    const delta = {
      x: world.x - active.start.x,
      y: world.y - active.start.y
    }
    if (isPointEqual(delta, active.delta)) {
      return
    }

    active.delta = delta
    writeEdgePreview(active.edgeId, moveEdge(active.edge, delta))
  }, [instance, writeEdgePreview])

  const startEdgeDrag = useCallback((
    event: PointerSourceEvent,
    edgeId: EdgeId,
    edge: EdgeItem['edge']
  ) => {
    if (!canMoveEdge(edge)) {
      return false
    }

    const nextSession = instance.interaction.start({
      mode: 'edge-drag',
      pointerId: event.pointerId,
      capture: readCaptureTarget(event),
      pan: {
        frame: (pointer) => {
          updateDragPreview(pointer)
        }
      },
      cleanup: clearDrag,
      move: (moveEvent, session) => {
        if (!activeRef.current) {
          return
        }

        session.pan(moveEvent)
        updateDragPreview(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        if (!isPointEqual(active.delta, { x: 0, y: 0 })) {
          instance.commands.edge.move(active.edgeId, active.delta)
          instance.commands.selection.clear()
        }
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = {
      edgeId,
      pointerId: event.pointerId,
      start: instance.viewport.pointer(event).world,
      delta: { x: 0, y: 0 },
      edge
    }
    sessionRef.current = nextSession
    return true
  }, [clearDrag, instance, updateDragPreview])

  useEffect(() => () => {
    cancelDrag()
  }, [cancelDrag])

  return {
    handleEdgePointerDown: (
      event: ReactPointerEvent<SVGPathElement>
    ) => {
      if (event.button !== 0) {
        return
      }

      const edgeId = event.currentTarget
        .closest('[data-edge-id]')
        ?.getAttribute('data-edge-id') as EdgeId | null
      if (!edgeId) {
        return
      }

      const entry = instance.read.edge.item.get(edgeId)
      if (!entry) {
        return
      }

      if (!hasEdge(instance.state.container.get(), entry.edge)) {
        leave(instance)
      }

      if (event.shiftKey || event.detail >= 2) {
        const point = instance.viewport.pointer(event).world
        instance.commands.edge.path.insert(edgeId, point)
        instance.commands.selection.selectEdge(edgeId)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      instance.commands.selection.selectEdge(edgeId)
      startEdgeDrag(event, edgeId, entry.edge)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

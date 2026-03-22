import { moveEdge } from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  hasEdge,
  leave
} from '../../../runtime/container'
import { useInternalInstance } from '../../../runtime/hooks'
import { toPatchEntry } from '../preview'
import type { PointerSourceEvent } from './inputShared'
import {
  canMoveEdge,
  readCaptureTarget
} from './inputShared'
import { useEdgePatchSession } from './useEdgePatchSession'

type ActiveDrag = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
  edge: EdgeItem['edge']
}

export const useEdgeDragInput = () => {
  const instance = useInternalInstance()

  const writePreview = useCallback((
    edgeId: EdgeId,
    patch: ReturnType<typeof moveEdge>
  ) => {
    if (!patch) {
      instance.internals.edge.preview.patch.clear()
      return
    }

    instance.internals.edge.preview.patch.write([
      toPatchEntry(edgeId, patch)
    ])
  }, [instance])

  const session = useEdgePatchSession<ActiveDrag>({
    mode: 'edge-drag',
    update: (active, input) => {
      const { world } = instance.viewport.pointer(input)
      const delta = {
        x: world.x - active.start.x,
        y: world.y - active.start.y
      }
      if (isPointEqual(delta, active.delta)) {
        return
      }

      active.delta = delta
      writePreview(active.edgeId, moveEdge(active.edge, delta))
    },
    commit: (active) => {
      if (!isPointEqual(active.delta, { x: 0, y: 0 })) {
        instance.commands.edge.move(active.edgeId, active.delta)
        instance.commands.selection.clear()
      }
    }
  })

  const startEdgeDrag = useCallback((
    event: PointerSourceEvent,
    edgeId: EdgeId,
    edge: EdgeItem['edge']
  ) => {
    if (!canMoveEdge(edge)) {
      return false
    }

    return session.start({
      event,
      capture: readCaptureTarget(event),
      active: {
        edgeId,
        pointerId: event.pointerId,
        start: instance.viewport.pointer(event).world,
        delta: { x: 0, y: 0 },
        edge
      }
    })
  }, [instance, session])

  return {
    handleEdgePointerDown: (
      event: ReactPointerEvent<SVGPathElement>
    ) => {
      if (event.button !== 0) {
        return
      }

      if (session.activeRef.current) {
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

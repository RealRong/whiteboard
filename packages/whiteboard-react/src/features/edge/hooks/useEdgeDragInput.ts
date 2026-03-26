import { moveEdge } from '@whiteboard/core/edge'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeId, EdgePatch, Point } from '@whiteboard/core/types'
import { useCallback } from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import type { EdgeDown } from '../../../runtime/input/pointer'
import { writeEdgePreviewPatch } from '../preview'
import {
  type PointerSourceEvent,
  useEdgePatchSession
} from './useEdgePatchSession'

type ActiveDrag = {
  edgeId: EdgeId
  pointerId: number
  start: Point
  delta: Point
}

export const useEdgeDragInput = () => {
  const instance = useInternalInstance()

  const readMovePatch = useCallback((
    edgeId: EdgeId,
    delta: Point
  ): EdgePatch | undefined => {
    const view = instance.read.edge.view.get(edgeId)
    if (!view?.can.move) {
      return undefined
    }

    return moveEdge(view.edge, delta)
  }, [instance])

  const writePreview = useCallback((
    edgeId: EdgeId,
    patch: EdgePatch | undefined
  ) => {
    if (!patch) {
      instance.internals.edge.preview.patch.clear()
      return
    }

    writeEdgePreviewPatch(instance.internals.edge.preview, edgeId, patch)
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
      const patch = readMovePatch(active.edgeId, delta)
      if (!patch) {
        return 'cancel'
      }
      writePreview(active.edgeId, patch)
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
    capture: Element
  ) => {
    const view = instance.read.edge.view.get(edgeId)
    if (!view?.can.move) {
      return false
    }

    return session.start({
      event,
      capture,
      active: {
        edgeId,
        pointerId: event.pointerId,
        start: instance.viewport.pointer(event).world,
        delta: { x: 0, y: 0 }
      }
    })
  }, [instance, session])

  return {
    down: (
      input: EdgeDown
    ) => {
      const { event } = input

      if (session.activeRef.current) {
        return false
      }

      if (input.pick.kind !== 'edge' || input.pick.part !== 'body') {
        return false
      }

      const edgeId = input.pick.id
      const view = instance.read.edge.view.get(edgeId)
      if (!view) {
        return false
      }

      if (event.shiftKey || event.detail >= 2) {
        if (!view.can.editRoute) {
          return false
        }

        const point = instance.viewport.pointer(event).world
        instance.commands.edge.route.insert(edgeId, point)
        instance.commands.selection.replace({
          edgeIds: [edgeId]
        })
        event.preventDefault()
        event.stopPropagation()
        return true
      }

      instance.commands.selection.replace({
        edgeIds: [edgeId]
      })
      const started = startEdgeDrag(event, edgeId, input.capture)
      if (!started) {
        return false
      }
      event.preventDefault()
      event.stopPropagation()
      return true
    }
  }
}

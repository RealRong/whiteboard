import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InternalInstance } from '../../../runtime/instance'
import {
  buildNodeDragState,
  resolveNodeDragCommit,
  resolveNodeDragFollowEdges,
  resolveNodeDragPosition,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './math'

type ActiveDrag = NodeDragRuntimeState & {
  allowCross: boolean
  relatedEdgeIds: readonly EdgeId[]
}

export type NodeDragStart = {
  pointerId: number
  capture: Element
  start: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  event: PointerEvent
}

export type NodeDragSession = {
  start: (input: NodeDragStart) => boolean
  cancel: () => void
}

export const createNodeDragSession = (
  instance: InternalInstance
): NodeDragSession => {
  let active: ActiveDrag | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = () => {
    active = null
    session = null
    instance.internals.node.chromeHidden.set(false)
    instance.internals.node.session.clear()
    instance.internals.snap.clear()
    instance.internals.edge.preview.patch.clear()
  }

  const commit = (draft: ActiveDrag) => {
    const nodeUpdates = resolveNodeDragCommit({
      draft
    })
    if (!nodeUpdates.length) {
      return
    }

    instance.commands.node.updateMany(nodeUpdates)
  }

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const world = instance.viewport.pointer(input).world
    const rawPosition = resolveNodeDragPosition({
      active,
      world
    })
    const snapped = instance.internals.snap.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: active.size.width,
        height: active.size.height
      },
      excludeIds: active.members.map((member) => member.id),
      allowCross: active.allowCross,
      disabled: !instance.read.tool.is('select')
    })
    const preview = resolveNodeDragPreview({
      active,
      position: {
        x: snapped.x,
        y: snapped.y
      },
      nodes: readCanvasNodes(),
      config: instance.config
    })

    active.last = preview.position
    const edgeUpdates = resolveNodeDragFollowEdges({
      active,
      positions: preview.patches,
      edgeIds: active.relatedEdgeIds,
      readEdge: (edgeId) => instance.engine.read.edge.item.get(edgeId)
    })

    instance.internals.node.session.write({
      patches: preview.patches,
      hoveredContainerId: preview.hoveredContainerId
    })
    instance.internals.edge.preview.patch.write(
      edgeUpdates.map(({ id, patch }) => ({
        id,
        pathPoints: patch.path?.points
      }))
    )
  }

  return {
    start: (input) => {
      const drag = buildNodeDragState({
        nodes: readCanvasNodes(),
        anchorId: input.anchorId,
        startWorld: input.start,
        origin: {
          x: input.frame.x,
          y: input.frame.y
        },
        size: {
          width: input.frame.width,
          height: input.frame.height
        },
        selectedNodeIds: input.nodeIds
      })
      if (!drag.members.length) {
        return false
      }

      const nextSession = instance.interaction.start({
        mode: 'node-drag',
        pointerId: input.pointerId,
        capture: input.capture,
        pan: {
          frame: updatePreview
        },
        cleanup: clear,
        move: (event, currentSession) => {
          if (!active) {
            return
          }

          active.allowCross = event.altKey
          currentSession.pan(event)
          updatePreview(event)
        },
        up: (_event, currentSession) => {
          if (!active) {
            return
          }

          commit(active)
          currentSession.finish()
        }
      })
      if (!nextSession) {
        return false
      }

      active = {
        allowCross: input.event.altKey,
        relatedEdgeIds: instance.read.edge.related(
          drag.members.map((member) => member.id)
        ),
        ...drag
      }
      session = nextSession
      instance.internals.node.session.clear()
      instance.internals.snap.clear()
      nextSession.pan(input.event)
      updatePreview(input.event)

      if (input.event.cancelable) {
        input.event.preventDefault()
      }

      return true
    },
    cancel: () => {
      session?.cancel()
    }
  }
}

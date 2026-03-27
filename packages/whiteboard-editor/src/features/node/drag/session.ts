import {
  moveEdge
} from '@whiteboard/core/edge'
import {
  buildMoveSet,
  resolveMoveEffect,
  type MoveSet
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InternalInstance } from '../../../runtime/instance'
import {
  toEdgePreviewEntry
} from '../../edge/preview'
import {
  clearNodeSessionPreview,
  writeNodeSessionPreview
} from '../session/node'

type ActiveDrag = {
  ids: readonly NodeId[]
  move: MoveSet
  startWorld: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  allowCross: boolean
  selectedEdgeIds: readonly EdgeId[]
  relatedEdgeIds: readonly EdgeId[]
}

export type NodeDragStart = {
  pointerId: number
  capture: Element
  start: Point
  frame: Rect
  anchorId: NodeId
  nodeIds: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
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
    clearNodeSessionPreview(instance.internals.node.session)
    instance.internals.snap.node.clear()
    instance.internals.edge.preview.patch.clear()
  }

  const commit = (draft: ActiveDrag) => {
    if (draft.last.x !== 0 || draft.last.y !== 0) {
      instance.commands.node.move({
        ids: draft.ids,
        delta: draft.last
      })
    }

    const edgeUpdates = draft.selectedEdgeIds.flatMap((edgeId) => {
      const edge = instance.read.edge.view.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, draft.last)
      if (!patch) {
        return []
      }

      return [{
        id: edgeId,
        patch
      }]
    })

    if (edgeUpdates.length) {
      instance.commands.edge.updateMany(edgeUpdates)
    }
  }

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const world = instance.viewport.pointer(input).world
    const rawPosition = {
      x: active.origin.x + (world.x - active.startWorld.x),
      y: active.origin.y + (world.y - active.startWorld.y)
    }
    const snapped = instance.internals.snap.node.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: active.size.width,
        height: active.size.height
      },
      excludeIds: active.move.members.map((member) => member.id),
      allowCross: active.allowCross,
      disabled: !instance.read.tool.is('select')
    })
    const delta = {
      x: snapped.x - active.origin.x,
      y: snapped.y - active.origin.y
    }
    const preview = resolveMoveEffect({
      nodes: readCanvasNodes(),
      edges: active.relatedEdgeIds
        .map((edgeId) => instance.read.edge.view.get(edgeId)?.edge)
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
      move: active.move,
      delta,
      nodeSize: instance.config.nodeSize
    })
    active.last = delta
    const selectedEdgeUpdates = active.selectedEdgeIds.flatMap((edgeId) => {
      const edge = instance.read.edge.view.get(edgeId)?.edge
      if (!edge) {
        return []
      }

      const patch = moveEdge(edge, delta)
      if (!patch) {
        return []
      }

      return [toEdgePreviewEntry(edgeId, patch)]
    })

    writeNodeSessionPreview(instance.internals.node.session, {
      patches: preview.nodes,
      hoveredContainerId: preview.hoveredContainerId
    })
    instance.internals.edge.preview.patch.write(
      [
        ...selectedEdgeUpdates,
        ...preview.edges.map(({ id, patch }) => ({
          id,
          route: patch.route
        }))
      ]
    )
  }

  return {
    start: (input) => {
      const ids = input.nodeIds.includes(input.anchorId)
        ? input.nodeIds
        : [input.anchorId]
      const move = buildMoveSet({
        nodes: readCanvasNodes(),
        ids
      })
      if (!move.members.length) {
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
        ids,
        move,
        startWorld: input.start,
        origin: {
          x: input.frame.x,
          y: input.frame.y
        },
        last: {
          x: 0,
          y: 0
        },
        size: {
          width: input.frame.width,
          height: input.frame.height
        },
        allowCross: input.event.altKey,
        selectedEdgeIds: input.edgeIds ?? [],
        relatedEdgeIds: instance.read.edge.related(
          move.members.map((member) => member.id)
        ).filter((edgeId) => !(input.edgeIds ?? []).includes(edgeId)),
      }
      session = nextSession
      clearNodeSessionPreview(instance.internals.node.session)
      instance.internals.snap.node.clear()
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
